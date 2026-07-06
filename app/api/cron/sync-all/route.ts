import { createAdminClient } from '@/lib/supabase/admin'
import { runScrape } from '../../scrape/route'
import { runSync } from '../../sync/route'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: stores, error: storesError } = await admin
    .from('shopify_stores')
    .select('id, shop_domain, access_token, sync_schedule')
    .neq('sync_schedule', 'off')
    .not('sync_schedule', 'is', null)

  if (storesError) {
    console.error('[cron:sync-all] failed to fetch stores:', storesError.message)
    return Response.json({ error: storesError.message }, { status: 500 })
  }

  if (!stores?.length) {
    return Response.json({ message: 'No stores with active schedule', processed: 0 })
  }

  const now = new Date()
  const dayOfWeek = now.getUTCDay()   // 0=Sunday, 1=Monday
  const dayOfMonth = now.getUTCDate()

  type ProductResult = {
    name: string
    status: 'ok' | 'error'
    step?: 'scrape' | 'sync'
    error?: string
    detail?: string
  }
  type StoreResult = {
    store: string
    skipped?: true
    reason?: string
    total?: number
    succeeded?: number
    failed?: number
    products?: ProductResult[]
  }
  const results: StoreResult[] = []

  for (const store of stores) {
    const schedule = store.sync_schedule as string
    const shouldRun =
      schedule === 'daily' ||
      (schedule === 'weekly' && dayOfWeek === 1) ||
      (schedule === 'monthly' && dayOfMonth === 1)

    if (!shouldRun) {
      console.log(`[cron:sync-all] ${store.shop_domain}: skipping (schedule=${schedule}, dayOfWeek=${dayOfWeek}, dayOfMonth=${dayOfMonth})`)
      results.push({ store: store.shop_domain, skipped: true, reason: `not due (${schedule})` })
      continue
    }

    const { data: products } = await admin
      .from('tracked_products')
      .select('id, label, shopify_product_title')
      .eq('store_id', store.id)
      .is('deleted_at', null)

    if (!products?.length) {
      results.push({ store: store.shop_domain, total: 0, succeeded: 0, failed: 0, products: [] })
      continue
    }

    let succeeded = 0
    let failed = 0
    const productResults: ProductResult[] = []

    for (const product of products) {
      const name = product.label || product.shopify_product_title || product.id
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scrapeRes = await runScrape(product.id, admin as any)
        if (!scrapeRes.ok) {
          const body = await scrapeRes.json().catch(() => ({})) as Record<string, string>
          const msg = body.error ?? `scrape HTTP ${scrapeRes.status}`
          const detail = body.detail ?? body.brand ?? undefined
          console.error(`[cron:sync-all] ${store.shop_domain} / "${name}" scrape failed: ${msg}${detail ? ` (${detail})` : ''}`)
          productResults.push({ name, status: 'error', step: 'scrape', error: msg, detail })
          failed++
          continue
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const syncRes = await runSync(product.id, admin as any, {
          shop_domain: store.shop_domain,
          access_token: store.access_token,
        })
        if (!syncRes.ok) {
          const body = await syncRes.json().catch(() => ({})) as Record<string, string>
          const msg = body.error ?? `sync HTTP ${syncRes.status}`
          const detail = body.detail ?? undefined
          console.error(`[cron:sync-all] ${store.shop_domain} / "${name}" sync failed: ${msg}${detail ? ` (${detail})` : ''}`)
          productResults.push({ name, status: 'error', step: 'sync', error: msg, detail })
          failed++
          continue
        }

        succeeded++
        productResults.push({ name, status: 'ok' })
        console.log(`[cron:sync-all] ${store.shop_domain} / "${name}": ok`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[cron:sync-all] ${store.shop_domain} / "${name}" threw: ${msg}`)
        productResults.push({ name, status: 'error', error: msg })
        failed++
      }
    }

    results.push({ store: store.shop_domain, total: products.length, succeeded, failed, products: productResults })
    console.log(`[cron:sync-all] ${store.shop_domain}: ${succeeded}/${products.length} succeeded, ${failed} failed`)
  }

  return Response.json({ processed: stores.length, results })
}
