'use client'

import { useState } from 'react'

export type SizeRow = {
  size: string
  regular_price: number | null
  sale_price: number | null
  scraped_at: string
}

export type ProductGroup = {
  id: string
  name: string
  lastScrapedAt: string
  sizes: SizeRow[]
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ProductAccordion({ products }: { products: ProductGroup[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  if (products.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <p className="text-sm text-gray-500">
          No sync history yet. Run a scrape from the Products page to get started.
        </p>
      </div>
    )
  }

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {products.map(product => {
        const isOpen = open.has(product.id)
        return (
          <div key={product.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(product.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              <span className="font-medium text-gray-900 flex-1 truncate">{product.name}</span>

              <span className="text-xs text-gray-400 shrink-0">
                Last scraped {new Date(product.lastScrapedAt).toLocaleString()}
              </span>

              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                {product.sizes.length} size{product.sizes.length !== 1 ? 's' : ''}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left py-2 font-medium">Size</th>
                      <th className="text-left py-2 font-medium">Regular</th>
                      <th className="text-left py-2 font-medium">Sale</th>
                      <th className="text-left py-2 font-medium">Last Scraped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {product.sizes.map(row => (
                      <tr key={row.size}>
                        <td className="py-2 font-medium text-gray-900">{row.size}</td>
                        <td className="py-2 text-gray-600 tabular-nums">{fmt(row.regular_price)}</td>
                        <td className="py-2 text-gray-900 tabular-nums">{fmt(row.sale_price)}</td>
                        <td className="py-2 text-xs text-gray-400">
                          {new Date(row.scraped_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
