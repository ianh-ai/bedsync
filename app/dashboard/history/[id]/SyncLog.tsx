'use client'

import React, { useState } from 'react'

type SyncDetail = {
  size: string
  old_price: number
  new_price: number
  old_compare_at: number | null
  new_compare_at: number | null
}

type SyncEvent = {
  id: string
  synced_at: string
  status: string
  details: SyncDetail[]
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SyncLog({ events }: { events: SyncEvent[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (events.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">No sync events recorded yet.</p>
      </div>
    )
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date/Time</th>
            <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Variants Updated</th>
            <th className="w-10 px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <React.Fragment key={event.id}>
              <tr
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => toggle(event.id)}
              >
                <td className="px-5 py-3 text-gray-700">{new Date(event.synced_at).toLocaleString()}</td>
                <td className="px-5 py-3 text-gray-600">
                  {event.details.length} variant{event.details.length !== 1 ? 's' : ''}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  <svg
                    className={`w-4 h-4 transition-transform ${expanded.has(event.id) ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </td>
              </tr>
              {expanded.has(event.id) && (
                <tr className="border-b border-gray-100">
                  <td colSpan={3} className="px-5 py-3 bg-gray-50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left py-1.5 font-medium w-24">Size</th>
                          <th className="text-left py-1.5 font-medium">Sale Price</th>
                          <th className="text-left py-1.5 font-medium">Compare At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {event.details.map(d => {
                          const saleChanged = d.old_price !== d.new_price
                          const catChanged = d.old_compare_at !== d.new_compare_at
                          return (
                            <tr key={d.size}>
                              <td className="py-1.5 font-medium text-gray-700">{d.size}</td>
                              <td className="py-1.5 text-gray-600">
                                {fmt(d.old_price)}
                                {' → '}
                                <span className={saleChanged ? 'font-medium text-blue-600' : ''}>
                                  {fmt(d.new_price)}
                                </span>
                              </td>
                              <td className="py-1.5 text-gray-600">
                                {fmt(d.old_compare_at)}
                                {' → '}
                                <span className={catChanged ? 'font-medium text-blue-600' : ''}>
                                  {fmt(d.new_compare_at)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
