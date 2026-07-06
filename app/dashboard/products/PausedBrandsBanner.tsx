'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PausedProduct {
  id: string
  brand: string
}

interface Props {
  products: PausedProduct[]
}

export default function PausedBrandsBanner({ products }: Props) {
  const router = useRouter()
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null)

  if (products.length === 0) return null

  // Group product IDs by brand
  const brandGroups = new Map<string, string[]>()
  for (const p of products) {
    if (!brandGroups.has(p.brand)) brandGroups.set(p.brand, [])
    brandGroups.get(p.brand)!.push(p.id)
  }

  async function handleRemoveBrand(brand: string) {
    const ids = brandGroups.get(brand) ?? []
    setDeletingBrand(brand)
    await Promise.all(ids.map(id => fetch(`/api/products/${id}`, { method: 'DELETE' })))
    router.refresh()
    setDeletingBrand(null)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <p className="text-sm font-semibold text-amber-800 mb-1">
        {brandGroups.size} brand{brandGroups.size !== 1 ? 's' : ''} {brandGroups.size !== 1 ? 'have' : 'has'} syncing paused because you&apos;re over your plan limit.
      </p>
      <p className="text-xs text-amber-700 mb-3">
        Remove brands or{' '}
        <a href="/dashboard/settings" className="underline font-medium">upgrade your plan</a>{' '}
        to resume syncing.
      </p>
      <ul className="divide-y divide-amber-200">
        {Array.from(brandGroups.entries()).map(([brand]) => (
          <li key={brand} className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-amber-900">{brand}</span>
            <button
              onClick={() => handleRemoveBrand(brand)}
              disabled={deletingBrand !== null}
              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
            >
              {deletingBrand === brand ? 'Removing…' : 'Remove brand'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
