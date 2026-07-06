import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runScrape } from '../scrape/route'
import { runSync } from '../sync/route'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: products, error: productsError } = await admin
      .from('tracked_products')
      .select('id, label, shopify_product_title, sync_paused')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (productsError) {
      console.error('[sync-all] failed to fetch products:', productsError.message)
      return Response.json({ error: productsError.message }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return Response.json({ total: 0, succeeded: 0, failed: 0, skipped: 0, paused: 0, results: [] })
    }

    const results: Array<{ product_name: string; status: 'ok' | 'error' | 'paused'; error?: string; skipped?: string[] }> = []
    let succeeded = 0
    let failed = 0
    let totalSkipped = 0
    let totalPaused = 0

    for (const product of products) {
      const name = (product.label as string | null) || (product.shopify_product_title as string | null) || product.id

      if ((product as { sync_paused?: boolean }).sync_paused) {
        results.push({ product_name: name, status: 'paused' })
        totalPaused++
        continue
      }

      try {
        const scrapeRes = await runScrape(product.id, supabase)
        if (!scrapeRes.ok) {
          const body = await scrapeRes.json().catch(() => ({}))
          const msg = (body as Record<string, string>).error ?? `scrape HTTP ${scrapeRes.status}`
          throw new Error(`scrape HTTP ${scrapeRes.status}: ${msg}`)
        }

        const syncRes = await runSync(product.id, supabase)
        if (!syncRes.ok) {
          const body = await syncRes.json().catch(() => ({}))
          const msg = (body as Record<string, string>).error ?? `sync HTTP ${syncRes.status}`
          throw new Error(`sync HTTP ${syncRes.status}: ${msg}`)
        }
        const syncBody = await syncRes.json().catch(() => ({})) as { skipped?: string[] }
        const productSkipped = Array.isArray(syncBody.skipped) ? syncBody.skipped : []
        totalSkipped += productSkipped.length

        results.push({ product_name: name, status: 'ok', skipped: productSkipped })
        succeeded++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[sync-all] failed for "${name}":`, message)
        results.push({ product_name: name, status: 'error', error: message })
        failed++
      }
    }

    console.log(`[sync-all] done — ${succeeded}/${products.length} succeeded, ${totalSkipped} skipped (guardrail), ${totalPaused} paused, ${failed} failed`)
    return Response.json({ total: products.length, succeeded, failed, skipped: totalSkipped, paused: totalPaused, results })
  } catch (err) {
    console.error('[sync-all] unhandled error:', err instanceof Error ? err.stack : err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
