'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PLAN_PRICE_IDS: Record<string, string> = {
  starter:  process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? '',
  pro:      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '',
  business: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? '',
}

const PLAN_PRICES: Record<string, string> = {
  starter: '$49', pro: '$99', business: '$149',
}

const UPGRADE_OPTIONS: Record<string, Array<{ tier: string; label: string; price: string }>> = {
  starter: [
    { tier: 'pro',      label: 'Upgrade to Pro',      price: '$99/mo' },
    { tier: 'business', label: 'Upgrade to Business', price: '$149/mo' },
  ],
  pro:      [{ tier: 'business', label: 'Upgrade to Business', price: '$149/mo' }],
  business: [],
}

const DOWNGRADE_OPTIONS: Record<string, Array<{ tier: string; label: string; price: string; priceId: string }>> = {
  business: [
    { tier: 'pro',     label: 'Downgrade to Pro',     price: '$99/mo', priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID     ?? '' },
    { tier: 'starter', label: 'Downgrade to Starter', price: '$49/mo', priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? '' },
  ],
  pro:      [{ tier: 'starter', label: 'Downgrade to Starter', price: '$49/mo', priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? '' }],
  starter:  [],
}

interface Props {
  planTier: string
  planStatus: string
  currentPeriodEnd: string | null
  pendingPlanTier: string | null
  pendingPlanDate: string | null
  brandCount: number
  brandLimit: number
}

export default function BillingActions({
  planTier, planStatus, currentPeriodEnd,
  pendingPlanTier, pendingPlanDate,
  brandCount, brandLimit,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmUpgrade, setConfirmUpgrade] = useState<{ tier: string; label: string; price: string } | null>(null)
  const [confirmDowngrade, setConfirmDowngrade] = useState<{ tier: string; label: string; price: string; priceId: string } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const isCanceling = planStatus === 'canceling'
  const endDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null
  const pendingDate = pendingPlanDate
    ? new Date(pendingPlanDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null
  const limitLabel = brandLimit === Infinity ? '∞' : String(brandLimit)
  const usedPct    = brandLimit === Infinity ? 0 : Math.min(100, Math.round((brandCount / brandLimit) * 100))

  const upgradeOptions  = UPGRADE_OPTIONS[planTier]  ?? []
  const downgradeOptions = (DOWNGRADE_OPTIONS[planTier] ?? [])
    .filter(opt => opt.tier !== pendingPlanTier) // hide the pending downgrade tier

  async function apiPost(url: string, body?: object) {
    const res = await fetch(url, {
      method: 'POST',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    return res.json() as Promise<{ success?: boolean; url?: string; error?: string }>
  }

  async function handleUpgradeConfirmed() {
    if (!confirmUpgrade) return
    const { tier } = confirmUpgrade
    setConfirmUpgrade(null)
    setLoading(`upgrade-${tier}`)
    const result = await apiPost('/api/stripe/upgrade', { newPriceId: PLAN_PRICE_IDS[tier] })
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(null)
  }

  async function handleDowngradeConfirmed() {
    if (!confirmDowngrade) return
    const { tier, priceId } = confirmDowngrade
    if (!priceId) {
      alert(`Configuration error: price ID for the "${tier}" plan is not set. Check NEXT_PUBLIC_STRIPE_${tier.toUpperCase()}_PRICE_ID in your environment.`)
      setConfirmDowngrade(null)
      return
    }
    setConfirmDowngrade(null)
    setLoading(`downgrade-${tier}`)
    const result = await apiPost('/api/stripe/downgrade', { newPriceId: priceId })
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(null)
  }

  async function handleCancelDowngrade() {
    setLoading('cancel-downgrade')
    const result = await apiPost('/api/stripe/cancel-downgrade')
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(null)
  }

  async function handleCancelConfirmed() {
    setConfirmCancel(false)
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
    <>
      {/* Downgrade confirmation modal */}
      {confirmDowngrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              Downgrade your plan?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              You&apos;ll lose access to premium features at the end of your billing period.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDowngradeConfirmed}
                disabled={loading !== null}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                Confirm downgrade
              </button>
              <button
                onClick={() => setConfirmDowngrade(null)}
                disabled={loading !== null}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Keep current plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              Cancel your subscription?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              You&apos;ll keep full access until the end of your billing period.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirmed}
                disabled={loading !== null}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                Confirm cancellation
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={loading !== null}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Keep subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade confirmation modal */}
      {confirmUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              {confirmUpgrade.label} — {PLAN_PRICES[confirmUpgrade.tier]}/mo
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              You&apos;ll be charged the prorated difference for the remainder of your billing cycle.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleUpgradeConfirmed}
                disabled={loading !== null}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? 'Upgrading…' : 'Confirm upgrade'}
              </button>
              <button
                onClick={() => setConfirmUpgrade(null)}
                disabled={loading !== null}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* Pending downgrade notice */}
        {pendingPlanTier && pendingDate && (
          <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-800">
              Downgrading to <span className="font-semibold capitalize">{pendingPlanTier}</span> on {pendingDate}.
              Your current plan remains active until then.
            </p>
            <button
              onClick={handleCancelDowngrade}
              disabled={loading !== null}
              className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
            >
              {loading === 'cancel-downgrade' ? 'Loading…' : 'Cancel Downgrade'}
            </button>
          </div>
        )}

        {/* Upgrade options */}
        {upgradeOptions.length > 0 && !isCanceling && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upgrade plan</p>
            {upgradeOptions.map(opt => (
              <button
                key={opt.tier}
                onClick={() => setConfirmUpgrade(opt)}
                disabled={loading !== null}
                className="w-full text-left px-4 py-3 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-sm font-medium text-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading === `upgrade-${opt.tier}` ? 'Upgrading…' : `${opt.label} — ${opt.price}`}
              </button>
            ))}
          </div>
        )}

        {/* Downgrade options */}
        {downgradeOptions.length > 0 && !isCanceling && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Downgrade plan</p>
            {downgradeOptions.map(opt => (
              <button
                key={opt.tier}
                onClick={() => setConfirmDowngrade(opt)}
                disabled={loading !== null}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading === `downgrade-${opt.tier}` ? 'Scheduling…' : `${opt.label} — ${opt.price}`}
              </button>
            ))}
            <p className="text-xs text-gray-400">
              Downgrades take effect at the end of your current billing period.
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
            onClick={() => setConfirmCancel(true)}
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
    </>
  )
}
