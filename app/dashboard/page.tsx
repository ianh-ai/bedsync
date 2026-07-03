import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductTable from './ProductTable'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: store } = await supabase
    .from('shopify_stores')
    .select('id')
    .eq('user_id', user!.id)
    .single()

  const { data: products } = store
    ? await supabase
        .from('tracked_products')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Fetch latest Queen price per product for the preview line
  const productIds = (products ?? []).map(p => p.id)
  const queenByProduct: Record<string, { sale: number; regular: number | null }> = {}
  if (productIds.length > 0) {
    const { data: queenPrices } = await supabase
      .from('prices')
      .select('tracked_product_id, sale_price, regular_price, scraped_at')
      .in('tracked_product_id', productIds)
      .eq('size', 'Queen')
      .order('scraped_at', { ascending: false })
    for (const row of (queenPrices ?? [])) {
      if (!queenByProduct[row.tracked_product_id]) {
        queenByProduct[row.tracked_product_id] = { sale: row.sale_price, regular: row.regular_price }
      }
    }
  }

  const productsWithQueen = (products ?? []).map(p => ({
    ...p,
    queen_sale_price: queenByProduct[p.id]?.sale ?? null,
    queen_regular_price: queenByProduct[p.id]?.regular ?? null,
  }))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tracked Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {products?.length ?? 0} product{products?.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <Link
          href="/dashboard/add"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </Link>
      </div>

      {!store && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-800 font-medium">No Shopify store connected yet.</p>
          <p className="text-sm text-amber-700 mt-1">
            Go to{' '}
            <Link href="/dashboard/settings" className="underline">Settings</Link>
            {' '}to connect your store.
          </p>
        </div>
      )}

      {store && (!products || products.length === 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">No products tracked yet</h3>
          <p className="text-sm text-gray-500 mb-4">Add your first product to start syncing prices.</p>
          <Link
            href="/dashboard/add"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add your first product
          </Link>
        </div>
      )}

      {products && products.length > 0 && (
        <ProductTable initialProducts={productsWithQueen} />
      )}
    </div>
  )
}
