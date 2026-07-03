import { createClient } from '@/lib/supabase/server'
import StoreConnectionForm from './StoreConnectionForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: store } = await supabase
    .from('shopify_stores')
    .select('shop_domain, shop_name, sync_schedule')
    .eq('user_id', user!.id)
    .single()

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Shopify Store</h2>

        {store?.shop_domain && (
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected: {store.shop_domain}
            </span>
          </div>
        )}

        <StoreConnectionForm initialDomain={store?.shop_domain} initialName={store?.shop_name} initialSchedule={store?.sync_schedule ?? 'off'} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Account</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>
    </div>
  )
}
