'use client'

import { useState } from 'react'

export default function SyncButton({ productId }: { productId: string }) {
  const [status, setStatus] = useState<'idle' | 'scraping' | 'syncing' | 'done' | 'error'>('idle')

  async function handleSync() {
    setStatus('scraping')
    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked_product_id: productId }),
      })
      if (!scrapeRes.ok) throw new Error('Scrape failed')

      setStatus('syncing')
      const syncRes = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked_product_id: productId }),
      })
      if (!syncRes.ok) throw new Error('Sync failed')

      setStatus('done')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const isLoading = status === 'scraping' || status === 'syncing'

  return (
    <button
      onClick={handleSync}
      disabled={isLoading}
      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
        status === 'done'
          ? 'bg-green-100 text-green-700'
          : status === 'error'
          ? 'bg-red-100 text-red-700'
          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-60'
      }`}
    >
      {status === 'scraping' ? 'Scraping…' :
       status === 'syncing' ? 'Syncing…' :
       status === 'done' ? 'Synced!' :
       status === 'error' ? 'Failed' :
       'Sync Now'}
    </button>
  )
}
