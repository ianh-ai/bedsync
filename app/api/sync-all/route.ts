import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runScrape } from '../scrape/route'
import { runSync } from '../sync/route'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: products } = await admin
    .from('tracked_products')
    .select('id, label, shopify_product_title, sync_paused')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

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
        throw new Error((body as Record<string, string>).error ?? `scrape ${scrapeRes.status}`)
      }

      const syncRes = await runSync(product.id, supabase)
      if (!syncRes.ok) {
        const body = await syncRes.json().catch(() => ({}))
        throw new Error((body as Record<string, string>).error ?? `sync ${syncRes.status}`)
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

  console.log(`[sync-all] done — ${succeeded}/${products.length} succeeded, ${totalSkipped} skipped (guardrail), ${totalPaused} paused`)
  return Response.json({ total: products.length, succeeded, failed, skipped: totalSkipped, paused: totalPaused, results })
}
