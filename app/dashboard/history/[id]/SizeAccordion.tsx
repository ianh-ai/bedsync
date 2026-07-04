'use client'

import React, { useState } from 'react'

export type ChangeRow = {
  recorded_at: string
  prev_sale: number
  new_sale: number
  prev_regular: number | null
  new_regular: number | null
}

export type SyncEntry = {
  synced_at: string
  old_price: number
  new_price: number
  old_compare_at: number | null
  new_compare_at: number | null
}

export type SizeData = {
  size: string
  currentSale: number
  currentRegular: number | null
  lastChangedAt: string | null
  changes: ChangeRow[]
  syncEntries: SyncEntry[]
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SizeAccordion({ sizes }: { sizes: SizeData[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  if (sizes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">
          No price history recorded yet. Run a scrape to start tracking.
        </p>
      </div>
    )
  }

  function toggle(size: string) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(size)) next.delete(size)
      else next.add(size)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {sizes.map(data => {
        const isOpen = open.has(data.size)
        return (
          <div key={data.size} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Collapsed header */}
            <button
              type="button"
              onClick={() => toggle(data.size)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              <span className="font-semibold text-gray-900 w-20 shrink-0">{data.size}</span>

              <span className="text-gray-900 font-medium tabular-nums">{fmt(data.currentSale)}</span>
              {data.currentRegular != null && (
                <span className="text-gray-500 text-sm line-through tabular-nums">
                  {fmt(data.currentRegular)}
                </span>
              )}

              <span className="ml-auto text-xs text-gray-500 shrink-0">
                {data.lastChangedAt
                  ? `Changed ${new Date(data.lastChangedAt).toLocaleDateString()}`
                  : 'No changes recorded'}
              </span>

              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                data.changes.length > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {data.changes.length} change{data.changes.length !== 1 ? 's' : ''}
              </span>
            </button>

            {/* Expanded body */}
            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {/* Price change log for this size */}
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Price Changes
                  </p>
                  {data.changes.length === 0 ? (
                    <p className="text-sm text-gray-500">No price changes recorded yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left pb-2 font-medium">Date/Time</th>
                          <th className="text-left pb-2 font-medium">Previous Sale</th>
                          <th className="text-left pb-2 font-medium">New Sale</th>
                          <th className="text-left pb-2 font-medium">Previous Regular</th>
                          <th className="text-left pb-2 font-medium">New Regular</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.changes.map((change, i) => (
                          <tr key={i}>
                            <td className="py-2 text-xs text-gray-500">
                              {new Date(change.recorded_at).toLocaleString()}
                            </td>
                            <td className="py-2 text-gray-500 tabular-nums">{fmt(change.prev_sale)}</td>
                            <td className={`py-2 font-medium tabular-nums ${
                              change.new_sale < change.prev_sale ? 'text-green-600'
                              : change.new_sale > change.prev_sale ? 'text-red-600'
                              : 'text-gray-900'
                            }`}>
                              {fmt(change.new_sale)}
                            </td>
                            <td className="py-2 text-gray-500 tabular-nums">{fmt(change.prev_regular)}</td>
                            <td className="py-2 text-gray-700 tabular-nums">{fmt(change.new_regular)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Sync events for this size */}
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Sync Events
                  </p>
                  {data.syncEntries.length === 0 ? (
                    <p className="text-sm text-gray-500">No sync events for this size.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left pb-2 font-medium">Date/Time</th>
                          <th className="text-left pb-2 font-medium">Sale: Before → After</th>
                          <th className="text-left pb-2 font-medium">Compare At: Before → After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.syncEntries.map((entry, i) => {
                          const saleChanged = entry.old_price !== entry.new_price
                          const catChanged = entry.old_compare_at !== entry.new_compare_at
                          return (
                            <tr key={i}>
                              <td className="py-2 text-xs text-gray-500">
                                {new Date(entry.synced_at).toLocaleString()}
                              </td>
                              <td className="py-2 text-gray-600 tabular-nums">
                                {fmt(entry.old_price)}
                                {' → '}
                                <span className={saleChanged ? 'font-medium text-blue-600' : ''}>
                                  {fmt(entry.new_price)}
                                </span>
                              </td>
                              <td className="py-2 text-gray-600 tabular-nums">
                                {fmt(entry.old_compare_at)}
                                {' → '}
                                <span className={catChanged ? 'font-medium text-blue-600' : ''}>
                                  {fmt(entry.new_compare_at)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
