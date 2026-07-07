import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runScrape } from '../scrape/route'
import { runSync } from '../sync/route'

export const runtime = 'nodejs'
export const maxDuration = 300

const SYNC_ALL_COOLDOWN_MS = 24 * 60 * 60 * 1000

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check 24-hour cooldown
  const { data: profile } = await admin
    .from('profiles')
    .select('sync_all_last_run_at')
    .eq('id', user.id)
    .single()

  const lastRun = (profile?.sync_all_last_run_at as string | null) ?? null
  if (lastRun) {
    const elapsed = Date.now() - new Date(lastRun).getTime()
    if (elapsed < SYNC_ALL_COOLDOWN_MS) {
      const nextSyncAt = new Date(new Date(lastRun).getTime() + SYNC_ALL_COOLDOWN_MS).toISOString()
      return Response.json({ error: 'Cooldown active', next_sync_at: nextSyncAt }, { status: 429 })
    }
  }

  // Fetch the user's store (including WooCommerce credentials)
  const { data: store } = await admin
    .from('shopify_stores')
    .select('id, shop_domain, access_token, platform, wc_consumer_key, wc_consumer_secret')
    .eq('user_id', user.id)
    .single()

  if (!store) return Response.json({ error: 'No store connected' }, { status: 400 })

  // Fetch all active, unpaused products
  const { data: products } = await admin
    .from('tracked_products')
    .select('id, label, shopify_product_title')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .eq('sync_paused', false)

  if (!products?.length) {
    await admin.from('profiles').update({ sync_all_last_run_at: new Date().toISOString() }).eq('id', user.id)
    return Response.json({ synced: 0, skipped: 0, failed: 0, total: 0 })
  }

  let synced = 0, skipped = 0, failed = 0
  const storeOverride = {
    shop_domain: store.shop_domain as string,
    access_token: store.access_token as string,
    platform: store.platform as string | null,
    wc_consumer_key: store.wc_consumer_key as string | null,
    wc_consumer_secret: store.wc_consumer_secret as string | null,
    userId: user.id,
  }

  for (const product of products) {
    const name = (product.label as string | null) || (product.shopify_product_title as string | null) || product.id
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scrapeRes = await runScrape(product.id, admin as any)
      if (!scrapeRes.ok) {
        console.log(`[sync-all] "${name}" scrape failed: ${scrapeRes.status}`)
        failed++
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syncRes = await runSync(product.id, admin as any, storeOverride)
      const syncBody = await syncRes.json().catch(() => ({})) as { skipped?: boolean; reason?: string }
      if (!syncRes.ok) {
        console.log(`[sync-all] "${name}" sync failed: ${syncRes.status}`)
        failed++
      } else if (syncBody.skipped) {
        console.log(`[sync-all] "${name}" skipped (${syncBody.reason ?? 'unknown'})`)
        skipped++
      } else {
        console.log(`[sync-all] "${name}" ok`)
        synced++
      }
    } catch (err) {
      console.error(`[sync-all] "${name}" threw:`, err instanceof Error ? err.message : err)
      failed++
    }
  }

  // Update cooldown timestamp once the run finishes
  await admin.from('profiles').update({ sync_all_last_run_at: new Date().toISOString() }).eq('id', user.id)

  console.log(`[sync-all] done — synced=${synced} skipped=${skipped} failed=${failed} total=${products.length}`)
  return Response.json({ synced, skipped, failed, total: products.length })
}
