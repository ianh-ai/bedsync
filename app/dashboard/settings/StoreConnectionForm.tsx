'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Connected view ────────────────────────────────────────────────────────────

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
  const label = next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `Next sync: ${label} at 6:00 AM UTC`
}

function ConnectedView({
  domain,
  platform,
  initialSchedule,
}: {
  domain: string
  platform: string
  initialSchedule: string
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [schedule, setSchedule] = useState<Schedule>((initialSchedule as Schedule) ?? 'off')
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)

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
  const platformLabel = platform === 'woocommerce' ? 'WooCommerce' : 'Shopify'

  return (
    <div className="space-y-5">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Disconnect {platformLabel} store?</h3>
            <p className="text-xs text-gray-600 mb-5">
              This will disconnect your store and permanently delete all tracked products and price history. This cannot be undone.
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

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {platformLabel} · {domain}
        </span>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={unlinking}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          {unlinking ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>

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
          {nextRun && <p className="text-xs text-gray-500">{nextRun}</p>}
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
    </div>
  )
}

// ── Shopify connect form ──────────────────────────────────────────────────────

function ShopifyConnectForm() {
  const [domain, setDomain] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleOAuth() {
    const trimmed = domain.trim()
    if (!trimmed) { setError('Enter your store domain first.'); return }
    let shop = trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase()
    if (!shop.endsWith('.myshopify.com')) shop = `${shop}.myshopify.com`
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}`
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Connect Shopify Store</h3>
      <div>
        <label htmlFor="oauthDomain" className="block text-sm font-medium text-gray-700 mb-1">Store domain</label>
        <input
          id="oauthDomain"
          type="text"
          value={domain}
          onChange={e => { setDomain(e.target.value); setError(null) }}
          placeholder="your-store.myshopify.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
        />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <button
        type="button"
        onClick={handleOAuth}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg"
      >
        Connect with Shopify
      </button>
    </div>
  )
}

// ── WooCommerce connect form ──────────────────────────────────────────────────

function WooCommerceConnectForm() {
  const router = useRouter()
  const [storeUrl, setStoreUrl] = useState('')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)

  async function handleConnect() {
    setConnecting(true)
    setResult(null)
    const res = await fetch('/api/connect-woocommerce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeUrl, consumerKey, consumerSecret }),
    })
    const data = await res.json() as { ok: boolean; error?: string }
    setConnecting(false)
    setResult(data)
    if (data.ok) setTimeout(() => { router.refresh() }, 800)
  }

  return (
    <div className="pt-5 border-t border-gray-100 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Connect WooCommerce Store</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Store URL</label>
        <input
          type="url"
          value={storeUrl}
          onChange={e => { setStoreUrl(e.target.value); setResult(null) }}
          placeholder="https://mystore.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Key</label>
        <input
          type="text"
          value={consumerKey}
          onChange={e => { setConsumerKey(e.target.value); setResult(null) }}
          placeholder="ck_xxxxxxxxxxxxxxxxxxxx"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Secret</label>
        <input
          type="password"
          value={consumerSecret}
          onChange={e => { setConsumerSecret(e.target.value); setResult(null) }}
          placeholder="cs_xxxxxxxxxxxxxxxxxxxx"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
        />
      </div>
      {result && (
        result.ok
          ? <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">WooCommerce store connected successfully.</p>
          : <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{result.error}</p>
      )}
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting || !storeUrl || !consumerKey || !consumerSecret}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {connecting ? 'Connecting…' : 'Connect WooCommerce'}
      </button>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StoreConnectionForm({
  initialDomain,
  initialPlatform = 'shopify',
  initialSchedule = 'off',
}: {
  initialDomain?: string
  initialName?: string
  initialPlatform?: string
  initialSchedule?: string
}) {
  if (initialDomain) {
    return (
      <ConnectedView
        domain={initialDomain}
        platform={initialPlatform}
        initialSchedule={initialSchedule}
      />
    )
  }

  return (
    <div className="space-y-0">
      <ShopifyConnectForm />
      <WooCommerceConnectForm />
    </div>
  )
}
