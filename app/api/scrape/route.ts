import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATALOG } from '@/lib/catalog'
import { scrapeForBrand, normalizeSize, type ScrapedVariant } from '@/lib/scrapers'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function runScrape(tracked_product_id: string, supabase: SupabaseClient): Promise<Response> {
  try {
    const { data: product, error: productError } = await createAdminClient()
      .from('tracked_products')
      .select('*')
      .eq('id', tracked_product_id)
      .single()

    if (productError || !product) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    let brand: string = product.brand ?? ''
    const variantFilter: string | null = product.variant_filter ?? null
    console.log(`[scrape] brand="${brand}" url="${product.manufacturer_url}" variant_filter=${variantFilter ?? 'none'}`)

    if (!brand) {
      try {
        const hostname = new URL(product.manufacturer_url).hostname.replace('www.', '')
        brand = hostname.split('.')[0]
        console.log(`[scrape] brand was empty — derived "${brand}" from hostname`)
      } catch {
        return Response.json({ error: 'Product has no brand and URL is invalid' }, { status: 400 })
      }
    }

    const now = new Date().toISOString()

    const catalogBrand = CATALOG.find(b => b.slug === brand.toLowerCase())
    const catalogEntry = catalogBrand?.products.find(e => e.name.toLowerCase() === (product.label ?? '').toLowerCase())
    const apiProductName = catalogEntry?.apiProductName

    const isHelix = brand.toLowerCase() === 'helix' || brand.toLowerCase() === 'birch'
    const maxAttempts = isHelix ? 1 : 3

    let scraped: ScrapedVariant[] | null = null
    let lastScrapeError: string | null = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        scraped = await scrapeForBrand(brand, product.manufacturer_url, variantFilter, product.label ?? undefined, apiProductName)
        break
      } catch (err) {
        lastScrapeError = err instanceof Error ? err.message : String(err)
        // Proxy timeouts and total fetch failures have no chance of succeeding on retry — bail immediately
        const isFatal = lastScrapeError.includes('timed out') || lastScrapeError.includes('All ScraperAPI')
        if (isFatal) {
          console.log(`[scrape] fatal error, not retrying: ${lastScrapeError}`)
          break
        }
        if (attempt < maxAttempts) {
          console.log(`[scrape] attempt ${attempt}/${maxAttempts} after failure: ${lastScrapeError}`)
          await new Promise(r => setTimeout(r, 2000))
        } else {
          console.error(`[scrape] Failed for brand="${brand}" after ${maxAttempts} attempt(s):`, err instanceof Error ? err.stack : err)
        }
      }
    }

    if (scraped === null) {
      const isHelixCloudflare = isHelix && (lastScrapeError?.includes('timed out') || lastScrapeError?.includes('All ScraperAPI') || lastScrapeError?.includes('fetch failed'))
      const userError = isHelixCloudflare
        ? 'Helix temporarily unavailable — Cloudflare is blocking scrapers. Try again later.'
        : 'Unsupported brand or scrape failed'
      await supabase.from('tracked_products').update({
        scrape_status: 'error',
        scrape_error: lastScrapeError,
        scrape_attempted_at: now,
      }).eq('id', tracked_product_id)
      return Response.json({ error: userError, brand, detail: lastScrapeError }, { status: 400 })
    }

    console.log(`[scrape] Extracted ${scraped.length} raw variants`)
    const priceRows: Array<{
      tracked_product_id: string
      size: string
      regular_price: number | null
      sale_price: number
      scraped_at: string
    }> = []

    for (const v of scraped) {
      const size = normalizeSize(v.title)
      if (!size) {
        console.log(`[scrape] Skipping unrecognized variant title: "${v.title}"`)
        continue
      }

      const salePrice = v.price             // current price consumers pay
      const regularPrice = v.compare_at_price  // MSRP/list price, or null if no active sale

      console.log(`[scrape] size="${size}" sale=${salePrice} regular=${regularPrice ?? 'null'}`)
      priceRows.push({ tracked_product_id, size, regular_price: regularPrice, sale_price: salePrice, scraped_at: now })
    }

    // Fetch previous prices for spike detection before inserting new ones
    const { data: prevPricesData } = await createAdminClient()
      .from('prices')
      .select('size, sale_price')
      .eq('tracked_product_id', tracked_product_id)
      .order('scraped_at', { ascending: false })
      .limit(100)

    const prevBySize: Record<string, number> = {}
    for (const row of (prevPricesData ?? [])) {
      if (prevBySize[row.size] == null) prevBySize[row.size] = row.sale_price
    }

    // Health checks
    let scrapeStatus: 'ok' | 'warning' | 'error' = 'ok'
    let healthWarning: string | null = null

    if (priceRows.length === 0) {
      scrapeStatus = 'warning'
      healthWarning = 'No recognizable size variants found'
    } else {
      const zeroPrices = priceRows.filter(r => r.sale_price === 0)
      if (zeroPrices.length > 0) {
        scrapeStatus = 'warning'
        healthWarning = `$0 price for: ${zeroPrices.map(r => r.size).join(', ')}`
      }
      if (scrapeStatus === 'ok') {
        for (const row of priceRows) {
          const prev = prevBySize[row.size]
          if (prev != null && prev > 0) {
            const change = Math.abs(row.sale_price - prev) / prev
            if (change > 0.6) {
              scrapeStatus = 'warning'
              healthWarning = `${row.size} price changed ${Math.round(change * 100)}% ($${prev} → $${row.sale_price})`
              break
            }
          }
        }
      }
    }

    console.log(`[scrape] health: ${scrapeStatus}${healthWarning ? ` — ${healthWarning}` : ''}`)
    await supabase.from('tracked_products').update({
      scrape_status: scrapeStatus,
      scrape_error: healthWarning,
      scrape_attempted_at: now,
    }).eq('id', tracked_product_id)

    if (priceRows.length === 0) {
      return Response.json({ error: 'No recognizable size variants found', scraped }, { status: 422 })
    }

    const { error: insertError } = await createAdminClient().from('prices').upsert(priceRows, { onConflict: 'tracked_product_id,size' })
    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    // If this insert fails with "relation does not exist", run:
    // supabase/migrations/20260702000000_price_history_sync_events.sql
    const historyRows = priceRows.map(r => ({
      product_id: r.tracked_product_id,
      size: r.size,
      sale_price: r.sale_price,
      regular_price: r.regular_price,
      recorded_at: r.scraped_at,
    }))
    const { error: historyError } = await createAdminClient().from('price_history').insert(historyRows)
    if (historyError) {
      console.error(`[scrape] price_history insert error:`, historyError.message)
    } else {
      console.log(`[scrape] price_history insert: ${historyRows.length} rows`)
    }

    await supabase
      .from('tracked_products')
      .update({ last_synced_at: now })
      .eq('id', tracked_product_id)

    return Response.json({ success: true, sizes: priceRows.map(r => r.size) })
  } catch (err) {
    console.error('[scrape] Unhandled error:', err instanceof Error ? err.stack : err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}

// Playwright can't run on Vercel serverless (crashes with "Cannot find module
// browsers.json") — scraping happens separately via GitHub Actions
// (scripts/daily-scrape.ts), which writes to brand_prices directly. The HTTP
// handler is disabled so Vercel never tries to invoke it; runScrape stays
// exported above so daily-scrape.ts can still import it.
export async function POST() {
  return Response.json(
    { error: 'Manual scraping is not available — prices are updated automatically each morning.' },
    { status: 503 }
  )
}
