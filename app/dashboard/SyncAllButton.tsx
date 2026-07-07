'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncAllButton({ productIds }: { productIds: string[] }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  async function handleSyncAll() {
    if (productIds.length === 0) return
    setStatus('running')
    setProgress(0)

    let failed = 0
    for (let i = 0; i < productIds.length; i++) {
      const id = productIds[i]
      try {
        const scrapeRes = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracked_product_id: id }),
        })
        if (!scrapeRes.ok) { failed++; setProgress(i + 1); continue }

        const syncRes = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracked_product_id: id }),
        })
        if (!syncRes.ok) failed++
      } catch {
        failed++
      }
      setProgress(i + 1)
    }

    setStatus(failed > 0 ? 'error' : 'done')
    router.refresh()
    setTimeout(() => { setStatus('idle'); setProgress(0) }, 4000)
  }

  const isRunning = status === 'running'

  return (
    <button
      onClick={handleSyncAll}
      disabled={isRunning || productIds.length === 0}
      className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
        status === 'done'
          ? 'bg-green-600 text-white'
          : status === 'error'
          ? 'bg-orange-500 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {isRunning
        ? `Syncing ${progress}/${productIds.length}…`
        : status === 'done'
        ? 'All Synced!'
        : status === 'error'
        ? 'Done (some errors)'
        : 'Sync All Now'}
    </button>
  )
}
