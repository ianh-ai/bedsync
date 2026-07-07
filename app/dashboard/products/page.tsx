import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserProfile, getBrandCount } from '@/lib/subscription'
import { getPlanLimit } from '@/lib/plans'
import ProductsClient from './ProductsClient'
import PausedBrandsBanner from './PausedBrandsBanner'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [{ data: store }, profile, brandCount] = await Promise.all([
    admin.from('shopify_stores').select('id, platform').eq('user_id', user!.id).single(),
    getUserProfile(user!.id),
    getBrandCount(user!.id),
  ])

  const planTier   = profile?.plan_tier ?? 'free'
  const brandLimit = getPlanLimit(planTier)
  const atLimit    = brandLimit !== Infinity && brandCount >= brandLimit
  const overLimit  = brandLimit !== Infinity && brandCount > brandLimit
  const limitLabel = brandLimit === Infinity ? '∞' : String(brandLimit)

  const { data: products, error: productsError } = await admin
    .from('tracked_products')
    .select('*')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const allProducts = products ?? []
  const pausedProducts = allProducts
    .filter((p: { sync_paused?: boolean }) => p.sync_paused)
    .map((p: { id: string; brand: string }) => ({ id: p.id, brand: p.brand }))
  const productIds = allProducts.map((p: { id: string }) => p.id)

  const queenByProduct: Record<string, number | null> = {}
  if (productIds.length > 0) {
    const { data: queenPrices } = await admin
      .from('prices')
      .select('tracked_product_id, sale_price, scraped_at')
      .in('tracked_product_id', productIds)
      .eq('size', 'Queen')
      .order('scraped_at', { ascending: false })

    for (const row of (queenPrices ?? []) as Array<{ tracked_product_id: string; sale_price: number }>) {
      if (!(row.tracked_product_id in queenByProduct)) {
        queenByProduct[row.tracked_product_id] = row.sale_price
      }
    }
  }

  const productsWithQueen = allProducts.map((p: Record<string, unknown>) => ({
    ...p,
    queen_sale_price: queenByProduct[p.id as string] ?? null,
  }))

  const usedPct = brandLimit === Infinity ? 0 : Math.min(100, Math.round((brandCount / brandLimit) * 100))

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {allProducts.length} product{allProducts.length !== 1 ? 's' : ''} tracked
          </p>
          {brandLimit !== Infinity && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">{brandCount} of {limitLabel} brand slots used</p>
              <div className="w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${atLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              {atLimit && (
                <p className="text-xs text-red-600 mt-1">
                  Brand limit reached —{' '}
                  <Link href="/#pricing" className="underline">upgrade</Link> to add more
                </p>
              )}
            </div>
          )}
        </div>
        {atLimit ? (
          <div title="Brand limit reached — upgrade to add more">
            <span className="inline-flex items-center gap-2 bg-gray-200 text-gray-400 text-sm font-semibold px-4 py-2 rounded-lg cursor-not-allowed select-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </span>
          </div>
        ) : (
          <Link
            href="/dashboard/add"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Link>
        )}
      </div>

      <PausedBrandsBanner products={pausedProducts} />

      {!store && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-6">
          <p className="text-sm text-amber-800 font-medium">No store connected yet.</p>
          <p className="text-sm text-amber-700 mt-1">
            Go to{' '}
            <Link href="/dashboard/settings" className="underline">
              Settings
            </Link>{' '}
            to connect your store.
          </p>
        </div>
      )}

      <ProductsClient
        initialProducts={productsWithQueen as Parameters<typeof ProductsClient>[0]['initialProducts']}
        storePlatform={store?.platform ?? 'shopify'}
        overLimit={overLimit}
      />
    </div>
  )
}
