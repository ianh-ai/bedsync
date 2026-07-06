import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile, getBrandCount } from '@/lib/subscription'
import { getPlanLimit } from '@/lib/plans'
import Sidebar from './Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profile, brandCount] = await Promise.all([
    getUserProfile(user.id),
    getBrandCount(user.id),
  ])

  const planTier   = profile?.plan_tier   ?? 'free'
  const planStatus = profile?.plan_status ?? 'inactive'
  const brandLimit = getPlanLimit(planTier)

  if (planStatus !== 'active' && planStatus !== 'canceling') {
    redirect('/#pricing?message=Choose a plan to get started')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        email={user.email ?? ''}
        planTier={planTier}
        planStatus={planStatus}
        brandCount={brandCount}
        brandLimit={brandLimit}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
