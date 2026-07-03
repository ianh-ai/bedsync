import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PriceChart from './PriceChart'
import SizeAccordion, { type SizeData } from './SizeAccordion'

type PriceHistoryRow = {
  id: string
  product_id: string
  size: string
  sale_price: number
  regular_price: number | null
  recorded_at: string
}

type SyncEvent = {
  id: string
  synced_at: string
  status: string
  details: Array<{
    size: string
    old_price: number
    new_price: number
    old_compare_at: number | null
    new_compare_at: number | null
  }>
}

const SIZE_ORDER = ['Twin', 'Twin XL', 'Full', 'Queen', 'King', 'Cal King']

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('tracked_products')
    .select('id, label, shopify_product_title')
    .eq('id', id)
    .single()

  if (!product) notFound()

  console.log(`[history] params.id="${id}"`)

  // Completely unfiltered — reveals what product_id values actually exist in the table
  const { data: rawSample, error: sampleError } = await supabase
    .from('price_history')
    .select('id, product_id, size, recorded_at')
    .limit(3)
  console.log(`[history] price_history unfiltered sample (error=${sampleError?.message ?? 'none'}):`, JSON.stringify(rawSample))

  const since = new Date()
  since.setDate(since.getDate() - 90)

  const [{ data: rawHistory, error: historyError }, { data: rawEvents, error: eventsError }] = await Promise.all([
    supabase
      .from('price_history')
      .select('*')
      .eq('product_id', id)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true }),
    supabase
      .from('sync_events')
      .select('*')
      .eq('product_id', id)
      .order('synced_at', { ascending: false })
      .limit(20),
  ])
  console.log(`[history] price_history filtered by product_id="${id}": count=${rawHistory?.length ?? 0} error=${historyError?.message ?? 'none'}`)
  console.log(`[history] sync_events filtered: count=${rawEvents?.length ?? 0} error=${eventsError?.message ?? 'none'}`)

  const history = (rawHistory ?? []) as PriceHistoryRow[]
  const syncEvents = (rawEvents ?? []) as SyncEvent[]

  // Group history rows by size (already ordered ASC by recorded_at)
  const rowsBySize = new Map<string, PriceHistoryRow[]>()
  for (const row of history) {
    if (!rowsBySize.has(row.size)) rowsBySize.set(row.size, [])
    rowsBySize.get(row.size)!.push(row)
  }

  // Build per-size data for the accordion
  const sizeDataList: SizeData[] = []
  for (const [size, rows] of rowsBySize) {
    const current = rows[rows.length - 1]!

    // Changes: consecutive rows where price differs
    const changes: SizeData['changes'] = []
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!
      const cur = rows[i]!
      if (prev.sale_price !== cur.sale_price || prev.regular_price !== cur.regular_price) {
        changes.push({
          recorded_at: cur.recorded_at,
          prev_sale: prev.sale_price,
          new_sale: cur.sale_price,
          prev_regular: prev.regular_price,
          new_regular: cur.regular_price,
        })
      }
    }
    changes.reverse() // newest first

    // Sync entries for this size, filtered from the global sync_events details
    const syncEntries: SizeData['syncEntries'] = []
    for (const event of syncEvents) {
      const detail = event.details.find(d => d.size === size)
      if (detail) {
        syncEntries.push({
          synced_at: event.synced_at,
          old_price: detail.old_price,
          new_price: detail.new_price,
          old_compare_at: detail.old_compare_at,
          new_compare_at: detail.new_compare_at,
        })
      }
    }

    sizeDataList.push({
      size,
      currentSale: current.sale_price,
      currentRegular: current.regular_price,
      lastChangedAt: changes.length > 0 ? changes[0].recorded_at : null,
      changes,
      syncEntries,
    })
  }

  // Sort by canonical mattress size order
  sizeDataList.sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.size)
    const bi = SIZE_ORDER.indexOf(b.size)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  // Chart data: one point per recorded_at timestamp, each size as a key
  const sizes = sizeDataList.map(d => d.size)
  const byTime = new Map<string, { time: string; [size: string]: string | number }>()
  for (const row of history) {
    if (!byTime.has(row.recorded_at)) byTime.set(row.recorded_at, { time: row.recorded_at })
    byTime.get(row.recorded_at)![row.size] = row.sale_price
  }
  const chartData = [...byTime.values()]

  const productName = (product as { label?: string; shopify_product_title?: string }).label
    || (product as { label?: string; shopify_product_title?: string }).shopify_product_title
    || id

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{productName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Price History &amp; Audit</p>
      </div>

      {/* Chart: sale price over time, all sizes */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Sale Price Over Time
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {chartData.length < 2 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Not enough data yet. Scrape at least twice to see price trends.
            </p>
          ) : (
            <PriceChart data={chartData} sizes={sizes} />
          )}
        </div>
      </section>

      {/* Per-size accordion: change log + sync events grouped by size */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Price History by Size
        </h2>
        <SizeAccordion sizes={sizeDataList} />
      </section>
    </div>
  )
}
