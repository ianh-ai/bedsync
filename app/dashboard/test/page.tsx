'use client'

import { useState, useRef } from 'react'
import { CATALOG, type CatalogEntry } from '@/lib/catalog'

type SizeResult = { title: string; price: number; compare_at_price: number | null }
type EntryResult =
  | { status: 'pending' }
  | { status: 'running' }
  | { status: 'ok'; sizes: SizeResult[] }
  | { status: 'error'; error: string }

const ALL_ENTRIES: CatalogEntry[] = CATALOG.flatMap(b => b.products)

async function testEntry(entry: CatalogEntry): Promise<EntryResult> {
  try {
    const res = await fetch('/api/test-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: entry.brand,
        url: entry.url,
        variant_filter: entry.variantFilter ?? null,
        api_product_name: entry.apiProductName ?? null,
      }),
    })
    const data = await res.json() as { success: boolean; sizes?: SizeResult[]; error?: string }
    if (data.success && data.sizes) return { status: 'ok', sizes: data.sizes }
    return { status: 'error', error: data.error ?? 'Unknown error' }
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) }
  }
}

export default function TestScraperPage() {
  const [activeBrand, setActiveBrand] = useState<string>('all')
  const [results, setResults] = useState<Record<string, EntryResult>>({})
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(1500)
  const abortRef = useRef(false)

  const visibleEntries = activeBrand === 'all'
    ? ALL_ENTRIES
    : CATALOG.find(b => b.slug === activeBrand)?.products ?? []

  const total = visibleEntries.length
  const done = visibleEntries.filter(e => {
    const r = results[e.id]
    return r?.status === 'ok' || r?.status === 'error'
  }).length
  const okCount = visibleEntries.filter(e => results[e.id]?.status === 'ok').length
  const errCount = visibleEntries.filter(e => results[e.id]?.status === 'error').length

  async function runEntries(entries: CatalogEntry[]) {
    setRunning(true)
    abortRef.current = false

    // Mark all as pending
    setResults(prev => {
      const next = { ...prev }
      for (const e of entries) next[e.id] = { status: 'pending' }
      return next
    })

    for (const entry of entries) {
      if (abortRef.current) break

      setResults(prev => ({ ...prev, [entry.id]: { status: 'running' } }))
      const result = await testEntry(entry)
      setResults(prev => ({ ...prev, [entry.id]: result }))
      if (!abortRef.current && delay > 0) await new Promise(r => setTimeout(r, delay))
    }

    setRunning(false)
  }

  function handleStop() {
    abortRef.current = true
  }

  function handleClear() {
    setResults({})
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Scraper Test</h1>
        <p className="text-sm text-gray-500 mt-0.5">Local dev tool — not committed to git.</p>
      </div>

      {/* Brand filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setActiveBrand('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            activeBrand === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({ALL_ENTRIES.length})
        </button>
        {CATALOG.map(brand => (
          <button
            key={brand.slug}
            onClick={() => setActiveBrand(brand.slug)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeBrand === brand.slug ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {brand.displayName} ({brand.products.length})
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        {!running ? (
          <button
            onClick={() => runEntries(visibleEntries)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {activeBrand === 'all' ? `Test All (${total})` : `Test ${CATALOG.find(b => b.slug === activeBrand)?.displayName} (${total})`}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Stop
          </button>
        )}

        <button
          onClick={handleClear}
          disabled={running}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors"
        >
          Clear
        </button>

        <div className="flex items-center gap-1.5 ml-2">
          <label className="text-sm text-gray-500">Delay</label>
          <input
            type="number"
            min={0}
            step={500}
            value={delay}
            onChange={e => setDelay(Math.max(0, Number(e.target.value)))}
            disabled={running}
            className="w-20 text-sm text-center border border-gray-200 rounded-lg px-2 py-2 disabled:opacity-50"
          />
          <span className="text-sm text-gray-500">ms</span>
        </div>

        {(running || done > 0) && (
          <span className="text-sm text-gray-600 tabular-nums">
            {done}/{total} complete
            {done > 0 && (
              <> · <span className="text-green-600">{okCount} ✓</span> · <span className="text-red-600">{errCount} ✗</span></>
            )}
          </span>
        )}
      </div>

      {/* Results table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-8"></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Brand</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Result</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleEntries.map(entry => {
              const result = results[entry.id]
              return (
                <tr key={entry.id} className={`hover:bg-gray-50 transition-colors ${result?.status === 'running' ? 'bg-blue-50' : ''}`}>
                  {/* Status icon */}
                  <td className="px-4 py-3 text-center">
                    {!result || result.status === 'pending' ? (
                      <span className="text-gray-300">—</span>
                    ) : result.status === 'running' ? (
                      <svg className="w-4 h-4 animate-spin text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : result.status === 'ok' ? (
                      <span className="text-green-600 text-base">✓</span>
                    ) : (
                      <span className="text-red-500 text-base">✗</span>
                    )}
                  </td>

                  {/* Product info */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{entry.name}</p>
                    {entry.variantFilter && (
                      <p className="text-xs text-gray-400 mt-0.5">filter: {entry.variantFilter}</p>
                    )}
                    {entry.apiProductName && (
                      <p className="text-xs text-blue-500 mt-0.5">api: {entry.apiProductName}</p>
                    )}
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded capitalize">
                      {entry.brand}
                    </span>
                  </td>

                  {/* Result */}
                  <td className="px-4 py-3 max-w-xs">
                    {result?.status === 'ok' && (
                      <div className="flex flex-wrap gap-1">
                        {result.sizes.map(s => (
                          <span key={s.title} className="inline-flex items-center text-xs bg-green-50 text-green-800 border border-green-200 rounded px-1.5 py-0.5">
                            {s.title} ${s.price.toFixed(0)}
                            {s.compare_at_price != null && (
                              <span className="text-green-600 ml-1 line-through">${s.compare_at_price.toFixed(0)}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    {result?.status === 'error' && (
                      <span className="text-xs text-red-600 break-words">{result.error}</span>
                    )}
                    {result?.status === 'running' && (
                      <span className="text-xs text-blue-600">Scraping…</span>
                    )}
                  </td>

                  {/* Per-row test button */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => runEntries([entry])}
                      disabled={running}
                      className="text-xs font-medium px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40 transition-colors"
                    >
                      Test
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
