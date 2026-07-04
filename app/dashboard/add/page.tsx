'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CATALOG, type CatalogEntry } from '@/lib/catalog'

function trackKey(brand: string, name: string): string {
  return `${brand.toLowerCase()}::${name.toLowerCase()}`
}

export default function AddProductPage() {
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [trackedKeys, setTrackedKeys] = useState<Set<string>>(new Set())
  const [activeBrand, setActiveBrand] = useState<string>('all')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [shopifyIds, setShopifyIds] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const [addedLocally, setAddedLocally] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: store } = await supabase
        .from('shopify_stores')
        .select('id')
        .eq('user_id', user.id)
        .single()

      setStoreId(store?.id ?? null)

      if (store?.id) {
        const { data: products } = await supabase
          .from('tracked_products')
          .select('brand, label')
          .eq('store_id', store.id)

        const keys = new Set<string>()
        for (const p of products ?? []) {
          keys.add(trackKey(p.brand ?? '', p.label ?? ''))
        }
        setTrackedKeys(keys)
      }

      setLoading(false)
    }
    load()
  }, [])

  function isTracked(entry: CatalogEntry): boolean {
    return trackedKeys.has(trackKey(entry.brand, entry.name)) || addedLocally.has(entry.id)
  }

  function toggleChecked(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAdd(entry: CatalogEntry) {
    const shopifyId = shopifyIds[entry.id]?.trim()
    if (!shopifyId || !storeId) return

    setAdding(prev => new Set([...prev, entry.id]))

    const supabase = createClient()
    const { error } = await supabase.from('tracked_products').insert({
      store_id: storeId,
      shopify_product_id: shopifyId,
      shopify_product_title: entry.name,
      manufacturer_url: entry.url,
      brand: entry.brand,
      label: entry.name,
      price_rule: 'match_sale',
      variant_filter: entry.variantFilter ?? null,
    })

    setAdding(prev => { const n = new Set(prev); n.delete(entry.id); return n })
    if (!error) {
      setAddedLocally(prev => new Set([...prev, entry.id]))
      setChecked(prev => { const n = new Set(prev); n.delete(entry.id); return n })
    }
  }

  const visibleBrands = activeBrand === 'all'
    ? CATALOG
    : CATALOG.filter(b => b.slug === activeBrand)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Add Products</h1>
        <p className="text-sm text-gray-500 mt-0.5">Select products from the catalog and enter your Shopify product IDs.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveBrand('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            activeBrand === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {CATALOG.map(brand => (
          <button
            key={brand.slug}
            onClick={() => setActiveBrand(brand.slug)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeBrand === brand.slug
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {brand.displayName}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !storeId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm text-amber-800">
            Connect a Shopify store in{' '}
            <Link href="/dashboard/settings" className="font-medium underline underline-offset-2">Settings</Link>
            {' '}before adding products.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleBrands.map(brand => (
            <div key={brand.slug} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">{brand.displayName}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {brand.products.map(entry => {
                  const tracked = isTracked(entry)
                  const isChecked = checked.has(entry.id)
                  const isAdding = adding.has(entry.id)
                  const shopifyId = shopifyIds[entry.id] ?? ''

                  return (
                    <div key={entry.id} className="px-5 py-3 flex items-center gap-3 min-h-[44px]">
                      {tracked ? (
                        <>
                          <span className="text-sm text-gray-500 flex-1">{entry.name}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Already added</span>
                        </>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChecked(entry.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                          />
                          <span className="text-sm text-gray-900 flex-1">{entry.name}</span>
                          {isChecked && (
                            <>
                              <input
                                type="text"
                                placeholder="Product ID"
                                value={shopifyId}
                                onChange={e => setShopifyIds(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 placeholder:text-gray-500"
                              />
                              <button
                                onClick={() => handleAdd(entry)}
                                disabled={!shopifyId.trim() || isAdding}
                                className="text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
                              >
                                {isAdding ? 'Adding…' : 'Add'}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
