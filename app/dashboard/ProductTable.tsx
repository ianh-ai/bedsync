'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SyncButton from './SyncButton'

type Product = {
  id: string
  label: string | null
  shopify_product_title: string | null
  manufacturer_url: string | null
  brand: string | null
  price_rule: string | null
  markup_value: number | null
  last_synced_at: string | null
  queen_sale_price: number | null
  queen_regular_price: number | null
  scrape_status: string | null
  scrape_error: string | null
  scrape_attempted_at: string | null
}

function ScrapeHealthBadge({ status, error, attemptedAt }: {
  status: string | null
  error: string | null
  attemptedAt: string | null
}) {
  if (!attemptedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
        Never checked
      </span>
    )
  }
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        Healthy
      </span>
    )
  }
  if (status === 'warning') {
    return (
      <span title={error ?? undefined} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 cursor-help">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        Warning
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span title={error ?? undefined} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 cursor-help">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        Error
      </span>
    )
  }
  return null
}

type SyncAllResult = {
  total: number
  succeeded: number
  failed: number
  skipped: number
  results: Array<{ product_name: string; status: 'ok' | 'error'; error?: string; skipped?: string[] }>
}

export default function ProductTable({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [syncAllStatus, setSyncAllStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [syncAllResult, setSyncAllResult] = useState<SyncAllResult | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Selection mode
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)

  function enterSelection() {
    setSelecting(true)
    setSelected(new Set())
  }

  function exitSelection() {
    setSelecting(false)
    setSelected(new Set())
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === products.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(products.map(p => p.id)))
    }
  }

  async function handleDeleteSelected() {
    const n = selected.size
    if (!window.confirm(`Delete ${n} product${n !== 1 ? 's' : ''}? This will remove all price history and cannot be undone.`)) return
    setDeletingSelected(true)
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => fetch(`/api/products/${id}`, { method: 'DELETE' })))
    setProducts(prev => prev.filter(p => !selected.has(p.id)))
    setDeletingSelected(false)
    exitSelection()
  }

  async function handleSyncAll() {
    setSyncAllStatus('running')
    setSyncAllResult(null)
    try {
      const res = await fetch('/api/sync-all')
      const data: SyncAllResult = await res.json()
      setSyncAllResult(data)
      router.refresh()
    } catch {
      setSyncAllResult({ total: 0, succeeded: 0, failed: 0, skipped: 0, results: [] })
    } finally {
      setSyncAllStatus('done')
      setTimeout(() => setSyncAllStatus('idle'), 8000)
    }
  }

  async function handleExport() {
    const res = await fetch('/api/export/csv')
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bedsync-prices.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This will remove all price history.`)) return
    setDeletingId(id)
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' })
      setProducts(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const allSelected = products.length > 0 && selected.size === products.length

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncAllStatus === 'running' || selecting}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 transition-colors"
          >
            {syncAllStatus === 'running' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Syncing {products.length} product{products.length !== 1 ? 's' : ''}…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync All
              </>
            )}
          </button>

          <button
            onClick={handleExport}
            disabled={selecting}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>

          {!selecting ? (
            <button
              onClick={enterSelection}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
            >
              Select
            </button>
          ) : (
            <>
              {selected.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={deletingSelected}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {deletingSelected ? 'Deleting…' : `Delete selected (${selected.size})`}
                </button>
              )}
              <button
                onClick={exitSelection}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {syncAllStatus === 'done' && syncAllResult && (
          <div className={`text-sm px-4 py-2 rounded-lg ${
            syncAllResult.failed === 0 && syncAllResult.skipped === 0
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {syncAllResult.succeeded}/{syncAllResult.total} synced
            {syncAllResult.skipped > 0 && `, ${syncAllResult.skipped} skipped (guardrail)`}
            {syncAllResult.failed > 0 && (
              <>. Failed: {syncAllResult.results.filter(r => r.status === 'error').map(r => r.product_name).join(', ')}</>
            )}
          </div>
        )}
      </div>

      {/* Product table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {selecting && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
              )}
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Product</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Brand</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Price Rule</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Synced</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Health</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(product => (
              <tr
                key={product.id}
                className={`hover:bg-gray-50 transition-colors ${selecting && selected.has(product.id) ? 'bg-blue-50' : ''}`}
              >
                {selecting && (
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggleOne(product.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-5 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{product.label || product.shopify_product_title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{product.manufacturer_url}</p>
                    {product.queen_sale_price != null && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Queen ${Math.round(product.queen_sale_price).toLocaleString()}
                        {product.queen_regular_price != null && ` · was $${Math.round(product.queen_regular_price).toLocaleString()}`}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                    {product.brand || '—'}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-600 capitalize">
                  {product.price_rule === 'markup' && product.markup_value
                    ? `+${product.markup_value}% above sale`
                    : product.price_rule?.replace(/_/g, ' ') || '—'}
                </td>
                <td className="px-5 py-4 text-gray-500 text-xs">
                  {product.last_synced_at
                    ? new Date(product.last_synced_at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
                    : '—'}
                </td>
                <td className="px-5 py-4">
                  <ScrapeHealthBadge
                    status={product.scrape_status}
                    error={product.scrape_error}
                    attemptedAt={product.scrape_attempted_at}
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <SyncButton productId={product.id} />

                    <Link
                      href={`/dashboard/history/${product.id}`}
                      className="p-1.5 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                      title="Price History"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </Link>

                    <Link
                      href={`/dashboard/edit/${product.id}`}
                      className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDelete(product.id, product.label || product.shopify_product_title || product.id)}
                      disabled={deletingId === product.id}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      title="Delete"
                    >
                      {deletingId === product.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
