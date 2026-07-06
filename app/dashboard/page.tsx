import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SyncAllButton from './SyncAllButton'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const showSubscribedBanner = params.subscribed === 'true'
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
        .select('id, label, shopify_product_title, scrape_status, scrape_attempted_at')
        .eq('store_id', store.id)
        .is('deleted_at', null)
    : { data: [] }

  const allProducts = products ?? []
  const productIds = allProducts.map((p: { id: string }) => p.id)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  const totalProducts = allProducts.length
  const failedSyncs = allProducts.filter(
    (p: { scrape_status: string | null }) => p.scrape_status === 'error'
  ).length
  const updatedToday = allProducts.filter(
    (p: { scrape_status: string | null; scrape_attempted_at: string | null }) =>
      p.scrape_status === 'ok' && p.scrape_attempted_at && p.scrape_attempted_at >= todayIso
  ).length
  const lastSyncAt = allProducts.reduce<string | null>(
    (latest, p: { scrape_attempted_at: string | null }) => {
      if (!p.scrape_attempted_at) return latest
      return !latest || p.scrape_attempted_at > latest ? p.scrape_attempted_at : latest
    },
    null
  )

  // ── Recent price changes ────────────────────────────────────────────────────
  type ChangeRow = {
    productName: string
    productId: string
    size: string
    before: number
    after: number
    diff: number
    updatedAt: string
  }

  let recentChanges: ChangeRow[] = []

  if (productIds.length > 0) {
    const { data: historyRows } = await supabase
      .from('price_history')
      .select('product_id, size, sale_price, recorded_at')
      .in('product_id', productIds)
      .order('recorded_at', { ascending: false })
      .limit(500)

    if (historyRows && historyRows.length > 0) {
      const nameByProduct: Record<string, string> = {}
      for (const p of allProducts as Array<{ id: string; label: string | null; shopify_product_title: string | null }>) {
        nameByProduct[p.id] = p.label || p.shopify_product_title || p.id
      }

      type Row = { product_id: string; size: string; sale_price: number; recorded_at: string }
      const grouped = new Map<string, Row[]>()
      for (const row of historyRows as Row[]) {
        const key = `${row.product_id}:${row.size}`
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(row)
      }

      for (const rows of grouped.values()) {
        if (rows.length < 2) continue
        const latest = rows[0]!
        const prev = rows[1]!
        if (latest.sale_price === prev.sale_price) continue
        recentChanges.push({
          productName: nameByProduct[latest.product_id] ?? latest.product_id,
          productId: latest.product_id,
          size: latest.size,
          before: prev.sale_price,
          after: latest.sale_price,
          diff: latest.sale_price - prev.sale_price,
          updatedAt: latest.recorded_at,
        })
      }

      recentChanges.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      recentChanges = recentChanges.slice(0, 10)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const stats: Array<{
    label: string
    value: string | number
    valueClass?: string
    link?: { href: string; label: string }
  }> = [
    {
      label: 'Total Products',
      value: totalProducts,
      link: totalProducts > 0 ? { href: '/dashboard/sync-log', label: 'View all' } : undefined,
    },
    {
      label: 'Updated Today',
      value: updatedToday,
      link: updatedToday > 0 ? { href: '/dashboard/sync-log', label: 'View changes' } : undefined,
    },
    {
      label: 'Failed Syncs',
      value: failedSyncs,
      valueClass: failedSyncs > 0 ? 'text-red-600' : undefined,
      link: failedSyncs > 0 ? { href: '/dashboard/sync-log', label: 'View errors' } : undefined,
    },
    {
      label: 'Last Sync',
      value: timeAgo(lastSyncAt),
      link: lastSyncAt ? { href: '/dashboard/sync-log', label: 'View log' } : undefined,
    },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {lastSyncAt && (
            <p className="text-sm text-gray-500 mt-0.5">
              Last sync: <span className="font-medium text-gray-700">{timeAgo(lastSyncAt)}</span>
            </p>
          )}
        </div>
        <SyncAllButton productIds={productIds} />
      </div>

      {/* Subscribed banner */}
      {showSubscribedBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 mb-6 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-green-800">Subscription activated! You&apos;re all set.</p>
        </div>
      )}

      {/* No store warning */}
      {!store && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-8">
          <p className="text-sm text-amber-800 font-medium">No Shopify store connected yet.</p>
          <p className="text-sm text-amber-700 mt-1">
            Go to <Link href="/dashboard/settings" className="underline">Settings</Link> to connect your store.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, valueClass, link }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
            <p className={`text-3xl font-bold leading-none mb-3 ${valueClass ?? 'text-gray-900'}`}>
              {String(value)}
            </p>
            {link ? (
              <Link href={link.href} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                {link.label} →
              </Link>
            ) : (
              <span className="text-xs text-transparent select-none">–</span>
            )}
          </div>
        ))}
      </div>

      {/* Recent Price Changes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Price Changes</h2>
          {recentChanges.length > 0 && (
            <Link href="/dashboard/sync-log" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              View All Changes →
            </Link>
          )}
        </div>

        {recentChanges.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm">No price changes recorded yet.</p>
            <p className="text-xs mt-1">Sync your products to start tracking changes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Before</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">After</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentChanges.map((change, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <Link
                        href={`/dashboard/history/${change.productId}`}
                        className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                      >
                        {change.productName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{change.size}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-gray-400 line-through">{fmt(change.before)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-gray-900">{fmt(change.after)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                        change.diff < 0
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {change.diff > 0 ? '+' : ''}{fmt(change.diff)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs text-gray-400 tabular-nums">
                      {timeAgo(change.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
