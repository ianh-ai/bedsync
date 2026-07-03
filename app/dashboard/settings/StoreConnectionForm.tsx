'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Schedule = 'off' | 'daily' | 'weekly' | 'monthly'

function nextRunText(schedule: Schedule): string | null {
  if (schedule === 'off') return null
  const now = new Date()
  let next: Date

  if (schedule === 'daily') {
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 6, 0, 0))
  } else if (schedule === 'weekly') {
    const day = now.getUTCDay()
    const daysUntil = day === 1 ? 7 : (8 - day) % 7
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil, 6, 0, 0))
  } else {
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 6, 0, 0))
  }

  const label = next.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  return `Next sync: ${label} at 6:00 AM UTC`
}

export default function StoreConnectionForm({
  initialDomain,
  initialSchedule = 'off',
}: {
  initialDomain?: string
  initialName?: string
  initialSchedule?: string
}) {
  const router = useRouter()
  const [oauthDomain, setOauthDomain] = useState(initialDomain ?? '')
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [schedule, setSchedule] = useState<Schedule>((initialSchedule as Schedule) ?? 'off')
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)

  function handleOAuth() {
    const trimmed = oauthDomain.trim()
    if (!trimmed) {
      setOauthError('Enter your store domain first.')
      return
    }
    let shop = trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase()
    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`
    }
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}`
  }

  async function handleUnlink() {
    setShowModal(false)
    setUnlinking(true)
    await fetch('/api/shopify/store?removeProducts=true', { method: 'DELETE' })
    router.refresh()
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true)
    setScheduleSaved(false)
    await fetch('/api/settings/store', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_schedule: schedule }),
    })
    setSavingSchedule(false)
    setScheduleSaved(true)
    setTimeout(() => setScheduleSaved(false), 2000)
  }

  const nextRun = nextRunText(schedule)

  return (
    <div className="space-y-5">
      {initialDomain && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={unlinking}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          {unlinking ? 'Unlinking…' : 'Unlink store'}
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Disconnect Shopify store?</h3>
            <p className="text-xs text-gray-600 mb-5">
              This will disconnect your Shopify store and permanently delete all tracked products and price history. This cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleUnlink}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Disconnect &amp; Delete
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 text-sm font-medium text-gray-700 py-2 px-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="oauthDomain" className="block text-sm font-medium text-gray-700 mb-1">
            Store domain
          </label>
          <input
            id="oauthDomain"
            type="text"
            value={oauthDomain}
            onChange={e => { setOauthDomain(e.target.value); setOauthError(null) }}
            placeholder="your-store.myshopify.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
          />
        </div>

        {oauthError && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{oauthError}</p>
        )}

        <button
          type="button"
          onClick={handleOAuth}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          Connect with Shopify
        </button>
      </div>

      {initialDomain && (
        <div className="pt-2 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Auto-sync Schedule</h3>
          <div className="space-y-3">
            <select
              value={schedule}
              onChange={e => { setSchedule(e.target.value as Schedule); setScheduleSaved(false) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (every Monday)</option>
              <option value="monthly">Monthly (1st of month)</option>
            </select>

            {nextRun && (
              <p className="text-xs text-gray-500">{nextRun}</p>
            )}

            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {savingSchedule ? 'Saving…' : scheduleSaved ? 'Saved ✓' : 'Save Schedule'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
