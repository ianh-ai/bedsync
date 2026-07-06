import { createClient } from '@/lib/supabase/server'
import { getUserProfile, getBrandCount } from '@/lib/subscription'
import { getPlanLimit } from '@/lib/plans'
import StoreConnectionForm from './StoreConnectionForm'
import BillingActions from './BillingActions'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: store }, profile, brandCount] = await Promise.all([
    supabase
      .from('shopify_stores')
      .select('shop_domain, shop_name, sync_schedule, platform')
      .eq('user_id', user!.id)
      .single(),
    getUserProfile(user!.id),
    getBrandCount(user!.id),
  ])

  const planTier   = profile?.plan_tier   ?? 'free'
  const planStatus = profile?.plan_status ?? 'inactive'
  const brandLimit = getPlanLimit(planTier)

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Store Connection</h2>
        <StoreConnectionForm
          initialDomain={store?.shop_domain}
          initialName={store?.shop_name}
          initialPlatform={store?.platform ?? 'shopify'}
          initialSchedule={store?.sync_schedule ?? 'off'}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Billing &amp; Subscription</h2>
        <BillingActions
          planTier={planTier}
          planStatus={planStatus}
          currentPeriodEnd={profile?.current_period_end ?? null}
          brandCount={brandCount}
          brandLimit={brandLimit}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Account</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>
    </div>
  )
}
