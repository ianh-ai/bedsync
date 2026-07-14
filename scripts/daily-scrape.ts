import { chromium, type Browser } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { scrapeForBrand, scrapeHelixWithPlaywright, normalizeSize, type ScrapedVariant } from '@/lib/scrapers'
import { BRAND_CONFIGS, type BrandConfig } from './brand-configs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[daily-scrape] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const BATCH_SIZE = 5
const RETENTION_DAYS = 7
// Playwright is used for these two brands only — both sit behind Cloudflare,
// and the daily batch run has no reason to spend ScraperAPI credits when a
// real headless browser gets past the challenge for free.
const PLAYWRIGHT_BRANDS = new Set(['helix', 'birch'])

type PriceRow = {
  brand: string
  url: string
  variant_filter: string | null
  size: string
  regular_price: number
  sale_price: number | null
  scraped_at: string
}

// regular_price is always the list price (never null); sale_price is only set
// when there's an active discount. This mirrors what the sync route expects:
// newPrice = sale_price ?? regular_price, newCompareAt = regular_price if > newPrice.
function toPriceRows(config: BrandConfig, variants: ScrapedVariant[], scrapedAt: string): PriceRow[] {
  const rows: PriceRow[] = []
  for (const v of variants) {
    const size = normalizeSize(v.title)
    if (!size) continue
    const hasSale = v.compare_at_price != null && v.compare_at_price > v.price
    rows.push({
      brand: config.brand,
      url: config.url,
      variant_filter: config.variant_filter,
      size,
      regular_price: hasSale ? v.compare_at_price! : v.price,
      sale_price: hasSale ? v.price : null,
      scraped_at: scrapedAt,
    })
  }
  return rows
}

async function scrapeOne(
  config: BrandConfig,
  browser: Browser | null
): Promise<{ rows: PriceRow[] } | { error: string }> {
  const scrapedAt = new Date().toISOString()
  try {
    const variants = PLAYWRIGHT_BRANDS.has(config.brand)
      ? await scrapeHelixWithPlaywright(config.url, browser!)
      : await scrapeForBrand(config.brand, config.url, config.variant_filter, config.product_name, config.api_product_name)

    const rows = toPriceRows(config, variants, scrapedAt)
    if (rows.length === 0) return { error: 'No recognizable size variants found' }
    return { rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(fn))
  }
}

function labelFor(config: BrandConfig): string {
  return `${config.brand} ${config.url}${config.variant_filter ? ` (${config.variant_filter})` : ''}`
}

async function main() {
  console.log(`[daily-scrape] Starting — ${BRAND_CONFIGS.length} configured product(s)`)

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error: deleteError, count } = await admin
    .from('brand_prices')
    .delete({ count: 'exact' })
    .lt('scraped_at', cutoff)
  if (deleteError) {
    console.error(`[daily-scrape] Cleanup failed:`, deleteError.message)
  } else {
    console.log(`[daily-scrape] Cleanup: deleted ${count ?? 0} row(s) older than ${RETENTION_DAYS} days`)
  }

  const needsBrowser = BRAND_CONFIGS.some(c => PLAYWRIGHT_BRANDS.has(c.brand))
  const browser = needsBrowser ? await chromium.launch({ headless: true }) : null

  let succeeded = 0
  let failed = 0

  try {
    await runInBatches(BRAND_CONFIGS, BATCH_SIZE, async (config) => {
      const label = labelFor(config)
      const result = await scrapeOne(config, browser)

      if ('error' in result) {
        failed++
        console.error(`[daily-scrape] ✗ ${label}: ${result.error}`)
        return
      }

      const { error: insertError } = await admin.from('brand_prices').insert(result.rows)
      if (insertError) {
        failed++
        console.error(`[daily-scrape] ✗ ${label}: insert failed — ${insertError.message}`)
        return
      }

      succeeded++
      console.log(`[daily-scrape] ✓ ${label}: ${result.rows.length} size(s)`)
    })
  } finally {
    if (browser) await browser.close()
  }

  console.log(`[daily-scrape] Done — ${succeeded} succeeded, ${failed} failed`)
  if (succeeded === 0 && failed > 0) process.exit(1)
}

main()
