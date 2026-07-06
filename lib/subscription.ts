import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimit } from '@/lib/plans'

export interface UserProfile {
  plan_tier: string
  plan_status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  pending_plan_tier: string | null
  pending_plan_date: string | null
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('plan_tier, plan_status, stripe_customer_id, stripe_subscription_id, current_period_end, pending_plan_tier, pending_plan_date')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as UserProfile
}

export async function getBrandCount(userId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tracked_products')
    .select('brand')
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (error || !data) return 0
  const distinct = new Set(data.map((r: { brand: string }) => r.brand).filter(Boolean))
  return distinct.size
}

export async function canAddBrand(
  userId: string,
  brandName: string
): Promise<{ allowed: boolean; reason?: string }> {
  const profile = await getUserProfile(userId)

  if (!profile || profile.plan_status !== 'active') {
    return { allowed: false, reason: 'No active subscription' }
  }

  const brandCount = await getBrandCount(userId)
  const limit = getPlanLimit(profile.plan_tier)

  if (brandCount >= limit) {
    return { allowed: false, reason: 'Brand limit reached' }
  }

  return { allowed: true }
}
