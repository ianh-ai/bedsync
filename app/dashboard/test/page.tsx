'use client'

import { useState } from 'react'
import { CATALOG } from '@/lib/catalog'

type VariantResult = { size: string; sale_price: number; regular_price: number | null }
type EntryResult =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ok'; variants: VariantResult[] }
  | { status: 'error'; error: string }

type Results = Record<string, EntryResult>

const ALL_ENTRIES = CATALOG.flatMap(b => b.products)

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> {
  const queue = [...tasks]
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (queue.length > 0) {
        const task = queue.shift()
        if (task) await task()
      }
    }),
  )
}

export default function TestPage() {
  const [results, setResults] = useState<Results>({})
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  function setEntryResult(id: string, result: EntryResult) {
    setResults(prev => ({ ...prev, [id]: result }))
  }

  async function runAll() {
    setRunning(true)
    setProgress({ done: 0, total: ALL_ENTRIES.length })

    const initial: Results = {}
    for (const e of ALL_ENTRIES) initial[e.id] = { status: 'idle' }
    setResults(initial)

    const tasks = ALL_ENTRIES.map(entry => async () => {
      setEntryResult(entry.id, { status: 'running' })
      try {
        const res = await fetch('/api/test-scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: entry.brand,
            url: entry.url,
            name: entry.name,
            variantFilter: entry.variantFilter,
          }),
        })
        const data = await res.json() as { ok: boolean; variants?: VariantResult[]; error?: string }
        if (data.ok && data.variants) {
          setEntryResult(entry.id, { status: 'ok', variants: data.variants })
        } else {
          setEntryResult(entry.id, { status: 'error', error: data.error ?? 'Unknown error' })
        }
      } catch (err) {
        setEntryResult(entry.id, { status: 'error', error: err instanceof Error ? err.message : String(err) })
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }))
    })

    await runWithConcurrency(tasks, 5)
    setRunning(false)
  }

  const done = progress.total > 0 ? progress.done : null
  const succeeded = Object.values(results).filter(r => r.status === 'ok').length
  const failed = Object.values(results).filter(r => r.status === 'error').length

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Scraper Test</h1>
          <p className="text-sm text-gray-500 mt-0.5">Verify scraper output for every catalog entry.</p>
        </div>
        <div className="flex items-center gap-4">
          {done !== null && (
            <span className="text-sm text-gray-500 tabular-nums">
              {running ? `${done} / ${progress.total}` : (
                <span>
                  <span className="text-green-600 font-medium">{succeeded} ok</span>
                  {failed > 0 && <span className="text-red-500 font-medium"> · {failed} failed</span>}
                </span>
              )}
            </span>
          )}
          <button
            onClick={runAll}
            disabled={running}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {running ? 'Running…' : 'Run All Tests'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {CATALOG.map(brand => (
          <div key={brand.slug} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">{brand.displayName}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {brand.products.map(entry => {
                const result = results[entry.id] ?? { status: 'idle' }
                return (
                  <div key={entry.id} className="px-5 py-2.5 flex items-start gap-3 min-h-[40px]">
                    <span className="text-sm text-gray-800 w-56 shrink-0 pt-0.5">{entry.name}</span>
                    <EntryStatus result={result} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EntryStatus({ result }: { result: EntryResult }) {
  if (result.status === 'idle') return <span className="text-sm text-gray-300">—</span>

  if (result.status === 'running') {
    return <span className="text-sm text-gray-400 animate-pulse">testing…</span>
  }

  if (result.status === 'error') {
    return (
      <span className="text-sm text-red-500 flex items-start gap-1.5">
        <span className="shrink-0 font-bold mt-px">✗</span>
        <span className="break-all">{result.error}</span>
      </span>
    )
  }

  // ok
  const queenVariant = result.variants.find(v => v.size === 'Queen') ?? result.variants[0]
  const sizeCount = result.variants.length

  return (
    <span className="text-sm text-green-600 flex items-start gap-1.5">
      <span className="shrink-0 font-bold mt-px">✓</span>
      <span>
        {queenVariant
          ? `Queen $${queenVariant.sale_price.toFixed(2)}`
          : 'no sizes'}
        {sizeCount > 0 && (
          <span className="text-gray-400 ml-1.5">({sizeCount} size{sizeCount !== 1 ? 's' : ''})</span>
        )}
      </span>
    </span>
  )
}
