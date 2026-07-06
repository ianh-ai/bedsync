import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimit } from '@/lib/plans'
import { syncWooCommerce } from '@/lib/sync-woocommerce'
import { rotateShopifyToken } from '@/lib/shopify-token-rotation'
import { getValidShopifyToken } from '@/lib/shopify-token'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const SIZE_TO_VARIANT_TITLE: Record<string, string[]> = {
  'Twin': ['Twin', 'TW'],
  'Twin XL': ['Twin XL', 'TXL', 'Twin Extra Long'],
  'Full': ['Full', 'Double', 'FL'],
  'Queen': ['Queen', 'QN'],
  'King': ['King', 'KG'],
  'Cal King': ['California King', 'Cal King', 'CK'],
}

export async function runSync(
  tracked_product_id: string,
  supabase: SupabaseClient,
  storeOverride?: { shop_domain: string; access_token: string; userId?: string }
): Promise<Response> {
  try {
    type StoreRecord = { shop_domain: string; access_token: string; platform?: string | null; wc_consumer_key?: string | null; wc_consumer_secret?: string | null }
    let store: StoreRecord | null = storeOverride ?? null
    let syncUserId: string | null = storeOverride?.userId ?? null
    let authUser: { id: string } | null = null

    if (!store) {
      const { data: { user } } = await supabase.auth.getUser()
      authUser = user
      console.log(`[sync] user: ${user?.id ?? 'none'}`)
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      syncUserId = user.id

      const { data: storeData, error: storeError } = await supabase
        .from('shopify_stores')
        .select('shop_domain, access_token, platform, wc_consumer_key, wc_consumer_secret')
        .eq('user_id', user.id)
        .single()
      console.log(`[sync] store: ${storeData?.shop_domain ?? 'none'} platform=${storeData?.platform ?? 'shopify'} (error: ${storeError?.message ?? 'none'})`)

      if (!storeData) {
        return Response.json({ error: 'No store connected' }, { status: 400 })
      }
      store = storeData
    } else {
      console.log(`[sync] store override: ${store.shop_domain}`)
    }

    // Plan limit enforcement — block sync if user is over their brand limit
    if (syncUserId) {
      const admin = createAdminClient()
      const [profileRes, brandsRes] = await Promise.all([
        admin.from('profiles').select('plan_tier').eq('id', syncUserId).single(),
        admin.from('tracked_products').select('brand').eq('user_id', syncUserId).is('deleted_at', null),
      ])
      const planTier = (profileRes.data?.plan_tier as string | null) ?? 'free'
      const distinctBrands = new Set((brandsRes.data ?? []).map((r: { brand: string | null }) => r.brand).filter(Boolean))
      const brandCount = distinctBrands.size
      const brandLimit = getPlanLimit(planTier)
      console.log(`[sync] plan check: tier=${planTier} brands=${brandCount}/${brandLimit === Infinity ? '∞' : brandLimit}`)
      if (brandCount > brandLimit) {
        return Response.json({ error: 'Plan limit exceeded. Remove brands to sync.' }, { status: 403 })
      }
    }

    const productUserId = authUser?.id ?? storeOverride?.userId ?? ''
    const { data: product, error: productError } = await createAdminClient()
      .from('tracked_products')
      .select('*')
      .eq('id', tracked_product_id)
      .eq('user_id', productUserId)
      .single()
    console.log(`[sync] product: ${product?.label ?? product?.shopify_product_title ?? 'none'} id=${product?.shopify_product_id ?? 'none'} (error: ${productError?.message ?? 'none'})`)

    if (productError || !product) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    if ((product as { sync_paused?: boolean }).sync_paused) {
      return Response.json({ skipped: true, reason: 'Brand sync paused — over plan limit' })
    }

    // Diagnostic: log the exact key and a sample unfiltered row to verify schema/values
    console.log(`[sync] prices query key: tracked_product_id="${tracked_product_id}"`)
    const { data: pricesSample } = await createAdminClient().from('prices').select('*').limit(1)
    console.log(`[sync] prices table sample (admin, unfiltered):`, JSON.stringify(pricesSample))

    // Fetch all price rows for this product ordered newest-first, then deduplicate
    // in JS to get the most recent row per size (equivalent to DISTINCT ON (size)).
    const { data: allPrices, error: pricesError } = await supabase
      .from('prices')
      .select('*')
      .eq('tracked_product_id', tracked_product_id)
      .order('scraped_at', { ascending: false })

    const seenSizes = new Set<string>()
    const latestPrices = (allPrices ?? []).filter(row => {
      if (seenSizes.has(row.size)) return false
      seenSizes.add(row.size)
      return true
    })
    console.log(`[sync] prices fetched: ${latestPrices?.length ?? 0} rows (error: ${pricesError?.message ?? 'none'})`)

    if (!latestPrices || latestPrices.length === 0) {
      console.error(`[sync] product ${tracked_product_id}: no scraped prices found — run scrape first`)
      return Response.json({ error: 'No scraped prices found. Run scrape first.' }, { status: 400 })
    }

    const priceBySize: Record<string, { regular_price: number; sale_price: number | null }> = {}
    for (const row of latestPrices) {
      if (!priceBySize[row.size]) {
        priceBySize[row.size] = { regular_price: row.regular_price, sale_price: row.sale_price }
      }
    }
    console.log(`[sync] priceBySize:`, JSON.stringify(priceBySize))

    if ((store.platform ?? 'shopify') === 'woocommerce') {
      const wcResult = await syncWooCommerce({
        storeUrl: store.shop_domain,
        consumerKey: store.wc_consumer_key!,
        consumerSecret: store.wc_consumer_secret!,
        productId: product.shopify_product_id,
        priceBySize,
      })
      await supabase.from('tracked_products').update({ last_synced_at: new Date().toISOString() }).eq('id', tracked_product_id)
      return Response.json({ success: true, ...wcResult })
    }

    const shopDomain = store.shop_domain
    let accessToken: string
    if (syncUserId) {
      try {
        accessToken = await getValidShopifyToken(syncUserId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[sync] token validation failed for user ${syncUserId}: ${msg}`)
        return Response.json({ error: msg }, { status: 503 })
      }
    } else {
      accessToken = store.access_token as string
    }

    const variantsUrl = `https://${shopDomain}/admin/api/2024-01/products/${product.shopify_product_id}/variants.json`
    console.log(`[sync] GET ${variantsUrl}`)
    let variantsRes = await fetch(variantsUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })
    console.log(`[sync] variants response: ${variantsRes.status}`)

    if (!variantsRes.ok) {
      const body = await variantsRes.text()
      console.error(`[sync] GET ${variantsUrl} failed: ${variantsRes.status} — ${body}`)
      if (variantsRes.status === 403 && body.toLowerCase().includes('non-expiring')) {
        console.log(`[sync] attempting token rotation for ${shopDomain}`)
        const newToken = await rotateShopifyToken(shopDomain)
        if (newToken) {
          accessToken = newToken
          console.log(`[sync] token rotated, retrying GET variants`)
          variantsRes = await fetch(variantsUrl, {
            headers: { 'X-Shopify-Access-Token': newToken, 'Content-Type': 'application/json' },
          })
          console.log(`[sync] variants retry response: ${variantsRes.status}`)
          if (!variantsRes.ok) {
            const retryBody = await variantsRes.text()
            console.error(`[sync] GET ${variantsUrl} retry failed: ${variantsRes.status} — ${retryBody}`)
            return Response.json({ error: `Shopify API error: ${variantsRes.status}` }, { status: 502 })
          }
        } else {
          return Response.json({
            error: 'Shopify token rotation failed — please reconnect your store in Settings.',
          }, { status: 403 })
        }
      } else {
        return Response.json({ error: `Shopify API error: ${variantsRes.status}` }, { status: 502 })
      }
    }

    const variantsData = await variantsRes.json()
    const shopifyVariants: Array<{ id: number; title: string; price: string; compare_at_price: string | null }> =
      variantsData.variants ?? []
    console.log(`[sync] shopify variants: ${shopifyVariants.map(v => `"${v.title}"`).join(', ')}`)

    type SyncDetail = {
      size: string
      old_price: number
      new_price: number
      old_compare_at: number | null
      new_compare_at: number | null
    }
    const syncDetails: SyncDetail[] = []
    const skippedSizes: string[] = []
    let updatedCount = 0

    for (const variant of shopifyVariants) {
      let matchedSize = findSizeForVariantTitle(variant.title)
      if (matchedSize === 'Cal King' && !priceBySize['Cal King']) {
        console.log(`[sync] variant "${variant.title}" → no "Cal King" price, falling back to "King"`)
        matchedSize = 'King'
      }
      if (!matchedSize || !priceBySize[matchedSize]) {
        console.log(`[sync] variant "${variant.title}" (id=${variant.id}) → no size match — skipping`)
        continue
      }

      const { regular_price, sale_price } = priceBySize[matchedSize]
      let newPrice: number

      if (product.price_mode === 'match') {
        newPrice = sale_price ?? regular_price
      } else if (product.price_mode === 'markup') {
        const base = sale_price ?? regular_price
        const val = product.markup_value ?? 0
        newPrice = product.markup_type === 'fixed'
          ? parseFloat((base + val).toFixed(2))
          : parseFloat((base * (1 + val / 100)).toFixed(2))
      } else if (product.price_rule === 'match_sale') {
        newPrice = sale_price ?? regular_price
      } else if (product.price_rule === 'match_regular') {
        newPrice = regular_price
      } else if (product.price_rule === 'markup') {
        const base = sale_price ?? regular_price
        const pct = product.markup_value ?? 0
        newPrice = parseFloat((base * (1 + pct / 100)).toFixed(2))
      } else {
        newPrice = sale_price ?? regular_price
      }

      // Show manufacturer's list price as the "was" strikethrough only when it's
      // actually higher than the computed price — avoids a fake strikethrough.
      const newCompareAt: number | null = regular_price > newPrice ? regular_price : null

      // Per-size guardrail check (floor/ceiling from guardrails jsonb)
      const guardrailsMap = (product.guardrails as Record<string, { floor?: number; ceiling?: number }> | null) ?? {}
      const rail = guardrailsMap[matchedSize!] ?? {}
      if (rail.floor != null && newPrice < rail.floor) {
        console.log(`[sync] SKIPPED "${matchedSize}" — $${newPrice.toFixed(2)} below floor $${rail.floor}`)
        skippedSizes.push(matchedSize!)
        continue
      }
      if (rail.ceiling != null && newPrice > rail.ceiling) {
        console.log(`[sync] SKIPPED "${matchedSize}" — $${newPrice.toFixed(2)} above ceiling $${rail.ceiling}`)
        skippedSizes.push(matchedSize!)
        continue
      }

      // Global guardrail check (guardrail_min / guardrail_max columns)
      const gMin = product.guardrail_min as number | null
      const gMax = product.guardrail_max as number | null
      if (gMin != null && newPrice < gMin) {
        console.log(`[sync] SKIPPED "${matchedSize}" — $${newPrice.toFixed(2)} below global min $${gMin}`)
        skippedSizes.push(matchedSize!)
        continue
      }
      if (gMax != null && newPrice > gMax) {
        console.log(`[sync] SKIPPED "${matchedSize}" — $${newPrice.toFixed(2)} above global max $${gMax}`)
        skippedSizes.push(matchedSize!)
        continue
      }

      const oldPrice = parseFloat(variant.price)
      const oldCompareAt = variant.compare_at_price != null ? parseFloat(variant.compare_at_price) : null

      const variantUrl = `https://${shopDomain}/admin/api/2024-01/variants/${variant.id}.json`
      console.log(
        `[sync] PUT ${variantUrl} — "${variant.title}" size="${matchedSize}" old_price=${variant.price} → new_price=${newPrice.toFixed(2)} compare_at=${newCompareAt?.toFixed(2) ?? 'null'}`
      )

      let variantRes = await fetch(variantUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variant: {
            price: newPrice.toFixed(2),
            compare_at_price: newCompareAt ? newCompareAt.toFixed(2) : null,
          },
        }),
      })

      console.log(`[sync] variant ${variant.id} update response: ${variantRes.status}`)
      if (!variantRes.ok) {
        const text = await variantRes.text()
        console.error(`[sync] PUT ${variantUrl} failed: ${variantRes.status} — ${text}`)
        if (variantRes.status === 403 && text.toLowerCase().includes('non-expiring')) {
          console.log(`[sync] attempting token rotation for ${shopDomain}`)
          const newToken = await rotateShopifyToken(shopDomain)
          if (newToken) {
            accessToken = newToken
            console.log(`[sync] token rotated, retrying PUT variant ${variant.id}`)
            variantRes = await fetch(variantUrl, {
              method: 'PUT',
              headers: { 'X-Shopify-Access-Token': newToken, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                variant: {
                  price: newPrice.toFixed(2),
                  compare_at_price: newCompareAt ? newCompareAt.toFixed(2) : null,
                },
              }),
            })
            console.log(`[sync] PUT retry response: ${variantRes.status}`)
            if (!variantRes.ok) {
              const retryText = await variantRes.text()
              console.error(`[sync] PUT ${variantUrl} retry failed: ${variantRes.status} — ${retryText}`)
              return Response.json(
                { error: `Shopify variant update failed: ${variantRes.status}`, detail: retryText },
                { status: 502 }
              )
            }
          } else {
            return Response.json({
              error: 'Shopify token rotation failed — please reconnect your store in Settings.',
            }, { status: 403 })
          }
        } else {
          return Response.json(
            { error: `Shopify variant update failed: ${variantRes.status}`, detail: text },
            { status: 502 }
          )
        }
      }

      updatedCount++
      syncDetails.push({
        size: matchedSize!,
        old_price: oldPrice,
        new_price: newPrice,
        old_compare_at: oldCompareAt,
        new_compare_at: newCompareAt,
      })
    }

    if (updatedCount === 0 && skippedSizes.length === 0) {
      console.error(`[sync] product ${tracked_product_id} (shopify_id=${product.shopify_product_id}): no variant titles matched known sizes — shopify variants: ${shopifyVariants.map(v => `"${v.title}"`).join(', ')}`)
      return Response.json({ error: 'No variant titles matched known sizes' }, { status: 422 })
    }

    // If this insert fails with "relation does not exist", run:
    // supabase/migrations/20260702000000_price_history_sync_events.sql
    const { error: syncEventError } = await supabase.from('sync_events').insert({
      product_id: tracked_product_id,
      synced_at: new Date().toISOString(),
      status: 'success',
      details: syncDetails,
    })
    if (syncEventError) {
      console.error('[sync] sync_events insert failed:', syncEventError.message)
    } else {
      console.log(`[sync] sync_events inserted (${syncDetails.length} detail(s))`)
    }

    await supabase
      .from('tracked_products')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', tracked_product_id)

    console.log(`[sync] done — updated ${updatedCount} variant(s), skipped ${skippedSizes.length} (guardrail)`)
    return Response.json({ success: true, updated: updatedCount, skipped: skippedSizes })
  } catch (err) {
    console.error('[sync] Unhandled error:', err instanceof Error ? err.stack : err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { tracked_product_id } = body
  if (!tracked_product_id) {
    return Response.json({ error: 'tracked_product_id required' }, { status: 400 })
  }
  const supabase = await createClient()
  return runSync(tracked_product_id, supabase)
}

function findSizeForVariantTitle(title: string): string | null {
  const t = title.toLowerCase()
  // Check most specific (longer) names first to prevent "Twin" matching "Twin XL"
  // and "King" matching "Cal King".
  if (t.includes('cal king') || t.includes('california king')) return 'Cal King'
  if (t.includes('twin xl') || t.includes('twin extra long') || t.includes('txl')) return 'Twin XL'
  if (t.includes('twin')) return 'Twin'
  if (t.includes('full') || t.includes('double')) return 'Full'
  if (t.includes('queen')) return 'Queen'
  if (t.includes('king')) return 'King'
  return null
}
