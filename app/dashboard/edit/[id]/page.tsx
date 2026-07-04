'use client'

import { use, useEffect, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { detectBrand } from '@/lib/brand-detector'

type PriceRule = 'match_sale' | 'match_regular' | 'markup'

const SIZES = ['Twin', 'Twin XL', 'Full', 'Queen', 'King', 'Cal King'] as const
type Size = typeof SIZES[number]
type SizeGuardrail = { floor: string; ceiling: string }

function emptyGuardrails(): Record<Size, SizeGuardrail> {
  return Object.fromEntries(SIZES.map(s => [s, { floor: '', ceiling: '' }])) as Record<Size, SizeGuardrail>
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [label, setLabel] = useState('')
  const [brand, setBrand] = useState('')
  const [manufacturerUrl, setManufacturerUrl] = useState('')
  const [shopifyProductId, setShopifyProductId] = useState('')
  const [priceRule, setPriceRule] = useState<PriceRule>('match_sale')
  const [markupValue, setMarkupValue] = useState('')
  const [variantFilter, setVariantFilter] = useState('')
  const [guardrails, setGuardrails] = useState<Record<Size, SizeGuardrail>>(emptyGuardrails())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('tracked_products').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setLabel(data.label ?? '')
        setBrand(data.brand ?? '')
        setManufacturerUrl(data.manufacturer_url ?? '')
        setShopifyProductId(data.shopify_product_id ?? '')
        setPriceRule((data.price_rule as PriceRule) ?? 'match_sale')
        setMarkupValue(data.markup_value != null ? String(data.markup_value) : '')
        setVariantFilter(data.variant_filter ?? '')

        if (data.guardrails) {
          const g = data.guardrails as Partial<Record<Size, { floor?: number; ceiling?: number }>>
          const loaded = emptyGuardrails()
          for (const size of SIZES) {
            const entry = g[size]
            if (entry) {
              loaded[size].floor = entry.floor != null ? String(entry.floor) : ''
              loaded[size].ceiling = entry.ceiling != null ? String(entry.ceiling) : ''
            }
          }
          setGuardrails(loaded)
        }
      }
      setLoading(false)
    })
  }, [id])

  function setRail(size: Size, field: 'floor' | 'ceiling', value: string) {
    setGuardrails(prev => ({ ...prev, [size]: { ...prev[size], [field]: value } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Build guardrails payload — omit sizes with both fields blank
    const guardrailsPayload: Partial<Record<Size, { floor?: number; ceiling?: number }>> = {}
    for (const size of SIZES) {
      const f = guardrails[size].floor.trim()
      const c = guardrails[size].ceiling.trim()
      const floor = f !== '' && !isNaN(parseFloat(f)) ? parseFloat(f) : undefined
      const ceiling = c !== '' && !isNaN(parseFloat(c)) ? parseFloat(c) : undefined
      if (floor != null || ceiling != null) {
        guardrailsPayload[size] = {}
        if (floor != null) guardrailsPayload[size]!.floor = floor
        if (ceiling != null) guardrailsPayload[size]!.ceiling = ceiling
      }
    }

    const res = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: label.trim() || null,
        brand: brand.trim() || null,
        manufacturer_url: manufacturerUrl.trim(),
        shopify_product_id: shopifyProductId.trim(),
        price_rule: priceRule,
        markup_value: priceRule === 'markup' ? parseFloat(markupValue) : null,
        variant_filter: variantFilter.trim() || null,
        guardrails: Object.keys(guardrailsPayload).length > 0 ? guardrailsPayload : null,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError((data as { error?: string }).error ?? 'Save failed')
      setSaving(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
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
        <h1 className="text-xl font-semibold text-gray-900">Edit Product</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input id="label" type="text" value={label} onChange={e => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <input id="brand" type="text" value={brand} onChange={e => setBrand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="manufacturerUrl" className="block text-sm font-medium text-gray-700 mb-1">Manufacturer URL</label>
            <input id="manufacturerUrl" type="url" required value={manufacturerUrl} onChange={e => setManufacturerUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            {detectBrand(manufacturerUrl) === 'winkbeds' && (
              <p className="text-xs text-amber-600 mt-1">
                Tip: Use the product URL (e.g. /products/the-luxury-firm-winkbed). If you paste a shop page URL, we&apos;ll try to resolve it automatically.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="shopifyProductId" className="block text-sm font-medium text-gray-700 mb-1">Shopify Product ID</label>
            <input id="shopifyProductId" type="text" required value={shopifyProductId} onChange={e => setShopifyProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="variantFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Variant filter <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input id="variantFilter" type="text" value={variantFilter} onChange={e => setVariantFilter(e.target.value)}
              placeholder="e.g. Hybrid, Plush, Medium Firm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500" />
          </div>

          <div>
            <label htmlFor="priceRule" className="block text-sm font-medium text-gray-700 mb-1">Price Rule</label>
            <select id="priceRule" value={priceRule} onChange={e => setPriceRule(e.target.value as PriceRule)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
              <option value="match_sale">Match sale price</option>
              <option value="match_regular">Match regular price</option>
              <option value="markup">Markup % above sale price</option>
            </select>
          </div>

          {priceRule === 'markup' && (
            <div>
              <label htmlFor="markupValue" className="block text-sm font-medium text-gray-700 mb-1">Markup Percentage</label>
              <div className="relative">
                <input id="markupValue" type="number" required min="0" step="0.1" value={markupValue}
                  onChange={e => setMarkupValue(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
              </div>
            </div>
          )}

          {/* Price Guardrails */}
          <details className="border border-gray-200 rounded-lg">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 flex items-center justify-between list-none">
              <span>Price Guardrails</span>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 py-3">
                Skip sync if the computed price falls outside these bounds. Leave blank to disable for that size.
              </p>
              <div className="grid grid-cols-[100px_1fr_1fr] gap-x-4 gap-y-2 items-center">
                <span className="text-xs font-medium text-gray-500">Size</span>
                <span className="text-xs font-medium text-gray-500">Floor</span>
                <span className="text-xs font-medium text-gray-500">Ceiling</span>
                {SIZES.map(size => (
                  <Fragment key={size}>
                    <span className="text-sm text-gray-700">{size}</span>
                    <input
                      type="number" min="0" step="1" placeholder="$ min"
                      value={guardrails[size].floor}
                      onChange={e => setRail(size, 'floor', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                    />
                    <input
                      type="number" min="0" step="1" placeholder="$ max"
                      value={guardrails[size].ceiling}
                      onChange={e => setRail(size, 'ceiling', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                    />
                  </Fragment>
                ))}
              </div>
            </div>
          </details>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-5 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
