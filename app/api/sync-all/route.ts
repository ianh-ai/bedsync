import { createClient } from '@/lib/supabase/server'
import { runScrape } from '../scrape/route'
import { runSync } from '../sync/route'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('shopify_stores')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!store) return Response.json({ error: 'No store connected' }, { status: 400 })

  const { data: products } = await supabase
    .from('tracked_products')
    .select('id, label, shopify_product_title')
    .eq('store_id', store.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!products || products.length === 0) {
    return Response.json({ total: 0, succeeded: 0, failed: 0, results: [] })
  }

  const results: Array<{ product_name: string; status: 'ok' | 'error'; error?: string; skipped?: string[] }> = []
  let succeeded = 0
  let failed = 0
  let totalSkipped = 0

  for (const product of products) {
    const name = product.label || product.shopify_product_title || product.id

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
      const productSkipped = syncBody.skipped ?? []
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

  console.log(`[sync-all] done — ${succeeded}/${products.length} succeeded, ${totalSkipped} skipped (guardrail)`)
  return Response.json({ total: products.length, succeeded, failed, skipped: totalSkipped, results })
}
