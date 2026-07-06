'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PLAN_PRICE_IDS: Record<string, string> = {
  starter:  process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? '',
  pro:      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '',
  business: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? '',
}

const UPGRADE_OPTIONS: Record<string, Array<{ tier: string; label: string; price: string }>> = {
  starter: [
    { tier: 'pro',      label: 'Upgrade to Pro',      price: '$99/mo' },
    { tier: 'business', label: 'Upgrade to Business', price: '$149/mo' },
  ],
  pro: [
    { tier: 'business', label: 'Upgrade to Business', price: '$149/mo' },
  ],
  business: [],
}

interface Props {
  planTier: string
  planStatus: string
  currentPeriodEnd: string | null
  brandCount: number
  brandLimit: number
}

export default function BillingActions({ planTier, planStatus, currentPeriodEnd, brandCount, brandLimit }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const isCanceling = planStatus === 'canceling'
  const endDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null
  const limitLabel = brandLimit === Infinity ? '∞' : String(brandLimit)
  const usedPct    = brandLimit === Infinity ? 0 : Math.min(100, Math.round((brandCount / brandLimit) * 100))
  const upgradeOptions = UPGRADE_OPTIONS[planTier] ?? []

  async function apiPost(url: string, body?: object) {
    const res = await fetch(url, {
      method: 'POST',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    return res.json() as Promise<{ success?: boolean; url?: string; error?: string }>
  }

  async function handleUpgrade(targetTier: string) {
    setLoading(`upgrade-${targetTier}`)
    const result = await apiPost('/api/stripe/upgrade', { newPriceId: PLAN_PRICE_IDS[targetTier] })
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(null)
  }

  async function handleCancel() {
    if (!confirm('Cancel your subscription? You keep full access until the end of your billing period.')) return
    setLoading('cancel')
    const result = await apiPost('/api/stripe/cancel')
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(null)
  }

  async function handleReactivate() {
    setLoading('reactivate')
    const result = await apiPost('/api/stripe/reactivate')
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(null)
  }

  async function handlePortal() {
    setLoading('portal')
    const result = await apiPost('/api/stripe/portal')
    if (result.url) { window.location.href = result.url; return }
    if (result.error) alert(result.error)
    setLoading(null)
  }

  return (
    <div className="space-y-6">

      {/* Plan info */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 capitalize">{planTier} Plan</p>
          {isCanceling && endDate
            ? <p className="text-xs text-amber-600 mt-0.5">Access ends {endDate}</p>
            : endDate
              ? <p className="text-xs text-gray-500 mt-0.5">Renews {endDate}</p>
              : null
          }
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          isCanceling ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
        }`}>
          {isCanceling ? 'Canceling' : 'Active'}
        </span>
      </div>

      {/* Brand slots usage */}
      {brandLimit !== Infinity && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Brand slots</span>
            <span>{brandCount} of {limitLabel} used</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${brandCount >= brandLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Upgrade options */}
      {upgradeOptions.length > 0 && !isCanceling && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upgrade plan</p>
          {upgradeOptions.map(({ tier, label, price }) => (
            <button
              key={tier}
              onClick={() => handleUpgrade(tier)}
              disabled={loading !== null}
              className="w-full text-left px-4 py-3 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-sm font-medium text-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading === `upgrade-${tier}` ? 'Upgrading…' : `${label} — ${price}`}
            </button>
          ))}
          <p className="text-xs text-gray-400">
            You&apos;ll only be charged the prorated difference for the remainder of your billing cycle.
          </p>
        </div>
      )}

      {/* Cancel / Reactivate */}
      {isCanceling ? (
        <p className="text-sm text-gray-600">
          Subscription ends {endDate ?? 'at period end'}.{' '}
          <button
            onClick={handleReactivate}
            disabled={loading !== null}
            className="text-indigo-600 font-medium hover:underline disabled:opacity-50"
          >
            {loading === 'reactivate' ? 'Loading…' : 'Reactivate'}
          </button>
        </p>
      ) : (
        <button
          onClick={handleCancel}
          disabled={loading !== null}
          className="text-sm text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
        >
          {loading === 'cancel' ? 'Canceling…' : 'Cancel subscription'}
        </button>
      )}

      {/* Payment method */}
      <div className="pt-5 border-t border-gray-100">
        <button
          onClick={handlePortal}
          disabled={loading !== null}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
        >
          {loading === 'portal' ? 'Loading…' : 'Update payment method →'}
        </button>
      </div>

    </div>
  )
}
