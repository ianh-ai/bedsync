'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { detectBrand } from '@/lib/brand-detector'

type PriceRule = 'match_sale' | 'match_regular' | 'markup'

type FormEntry = {
  id: string
  label: string
  manufacturerUrl: string
  shopifyProductId: string
  variantFilter: string
  priceRule: PriceRule
  markupValue: string
}

function emptyEntry(): FormEntry {
  return {
    id: crypto.randomUUID(),
    label: '',
    manufacturerUrl: '',
    shopifyProductId: '',
    variantFilter: '',
    priceRule: 'match_sale',
    markupValue: '',
  }
}

export default function AddProductPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<FormEntry[]>([emptyEntry()])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ added: number; failed: number } | null>(null)

  function update(id: string, field: keyof FormEntry, value: string) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  function addEntry() {
    setEntries(prev => [...prev, emptyEntry()])
  }

  function removeEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setSubmitting(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { data: store } = await supabase
      .from('shopify_stores')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!store) { setSubmitting(false); return }

    const settled = await Promise.allSettled(
      entries.map(e =>
        supabase.from('tracked_products').insert({
          store_id: store.id,
          shopify_product_id: e.shopifyProductId.trim() || '',
          shopify_product_title: e.label,
          manufacturer_url: e.manufacturerUrl,
          brand: detectBrand(e.manufacturerUrl),
          label: e.label,
          price_rule: e.priceRule,
          markup_value: e.priceRule === 'markup' ? (parseFloat(e.markupValue) || 0) : null,
          variant_filter: e.variantFilter.trim() || null,
        }).then(({ error }) => { if (error) throw new Error(error.message) })
      )
    )

    const added = settled.filter(r => r.status === 'fulfilled').length
    const failed = settled.filter(r => r.status === 'rejected').length
    setSubmitting(false)
    setResult({ added, failed })

    if (failed === 0) {
      setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1200)
    }
  }

  if (result) {
    return (
      <div className="p-8 max-w-2xl">
        <div className={`border rounded-xl p-6 ${result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-sm font-semibold ${result.failed === 0 ? 'text-green-800' : 'text-amber-800'}`}>
            {result.added} product{result.added !== 1 ? 's' : ''} added{result.failed > 0 ? `, ${result.failed} failed` : ''}
          </p>
          {result.failed === 0 && (
            <p className="text-xs text-green-600 mt-1">Redirecting to dashboard…</p>
          )}
        </div>
        {result.failed > 0 && (
          <div className="mt-4">
            <button
              onClick={() => { router.push('/dashboard'); router.refresh() }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Add Products</h1>
        <p className="text-sm text-gray-500 mt-0.5">Link Shopify products to manufacturer URLs for price tracking.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {entries.map((entry, idx) => (
          <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-6 relative">
            {entries.length > 1 && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Product {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  required
                  value={entry.label}
                  onChange={e => update(entry.id, 'label', e.target.value)}
                  placeholder="e.g. Helix Midnight Luxe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer URL</label>
                <input
                  type="url"
                  required
                  value={entry.manufacturerUrl}
                  onChange={e => update(entry.id, 'manufacturerUrl', e.target.value)}
                  placeholder="e.g. https://helixsleep.com/products/helix-midnight-luxe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                />
                {entry.manufacturerUrl && (
                  <p className="text-xs text-gray-400 mt-1">
                    Detected brand:{' '}
                    <span className="font-medium text-gray-600 capitalize">
                      {detectBrand(entry.manufacturerUrl) || 'unknown'}
                    </span>
                  </p>
                )}
                {detectBrand(entry.manufacturerUrl) === 'winkbeds' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Tip: Use the product URL (e.g. /products/the-luxury-firm-winkbed). If you paste a shop page URL, we&apos;ll try to resolve it automatically.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shopify Product ID</label>
                <input
                  type="text"
                  value={entry.shopifyProductId}
                  onChange={e => update(entry.id, 'shopifyProductId', e.target.value)}
                  placeholder="e.g. 8291234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">Find this in your Shopify admin under Products. Leave blank to set later.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variant filter <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={entry.variantFilter}
                  onChange={e => update(entry.id, 'variantFilter', e.target.value)}
                  placeholder="e.g. Hybrid, Plush, Medium Firm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Rule</label>
                <select
                  value={entry.priceRule}
                  onChange={e => update(entry.id, 'priceRule', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="match_sale">Match sale price</option>
                  <option value="match_regular">Match regular price</option>
                  <option value="markup">Markup % above sale price</option>
                </select>
              </div>

              {entry.priceRule === 'markup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Markup Percentage</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.1"
                      value={entry.markupValue}
                      onChange={e => update(entry.id, 'markupValue', e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addEntry}
          className="w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          + Add Another
        </button>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {submitting
              ? 'Adding…'
              : entries.length === 1
                ? 'Add Product'
                : `Add ${entries.length} Products`}
          </button>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-5 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
