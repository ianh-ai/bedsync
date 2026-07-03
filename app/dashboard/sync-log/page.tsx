import { createClient } from '@/lib/supabase/server'
import ProductAccordion, { type ProductGroup } from './ProductAccordion'

const SIZE_ORDER = ['Twin', 'Twin XL', 'Full', 'Queen', 'King', 'Cal King']

export default async function SyncLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: store } = await supabase
    .from('shopify_stores')
    .select('id')
    .eq('user_id', user!.id)
    .single()

  const { data: products } = store
    ? await supabase
        .from('tracked_products')
        .select('id')
        .eq('store_id', store.id)
    : { data: [] }

  const productIds = (products ?? []).map((p: { id: string }) => p.id)

  const { data: prices } = productIds.length > 0
    ? await supabase
        .from('prices')
        .select('*, tracked_products(label, shopify_product_title)')
        .in('tracked_product_id', productIds)
        .order('scraped_at', { ascending: false })
        .limit(500)
    : { data: [] }

  // Deduplicate to latest row per (product, size), then group by product
  const seenKeys = new Set<string>()
  const productMap = new Map<string, ProductGroup>()

  for (const row of (prices ?? []) as Array<Record<string, unknown>>) {
    const pid = row.tracked_product_id as string
    const size = row.size as string
    const key = `${pid}:${size}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    const tp = row.tracked_products as { label?: string; shopify_product_title?: string } | null
    const name = tp?.label || tp?.shopify_product_title || pid
    const scrapedAt = row.scraped_at as string

    if (!productMap.has(pid)) {
      productMap.set(pid, { id: pid, name, lastScrapedAt: scrapedAt, sizes: [] })
    }

    const group = productMap.get(pid)!
    if (scrapedAt > group.lastScrapedAt) group.lastScrapedAt = scrapedAt
    group.sizes.push({
      size,
      regular_price: row.regular_price as number | null,
      sale_price: row.sale_price as number | null,
      scraped_at: scrapedAt,
    })
  }

  // Sort products alphabetically; sizes in standard mattress order within each
  const productGroups = [...productMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  for (const group of productGroups) {
    group.sizes.sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.size)
      const bi = SIZE_ORDER.indexOf(b.size)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Sync Log</h1>
      <ProductAccordion products={productGroups} />
    </div>
  )
}
