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

export async function resumeBrandsWithinLimit(userId: string, planTier: string): Promise<void> {
  const admin = createAdminClient()
  const limit = getPlanLimit(planTier)

  const { data: allActive } = await admin
    .from('tracked_products')
    .select('id, brand, created_at, sync_paused')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const products = (allActive ?? []) as Array<{ id: string; brand: string; created_at: string; sync_paused: boolean }>

  const brandOrder: string[] = []
  const brandSet = new Set<string>()
  for (const p of products) {
    if (!brandSet.has(p.brand)) {
      brandSet.add(p.brand)
      brandOrder.push(p.brand)
    }
  }

  const withinLimit = limit === Infinity
    ? new Set(brandOrder)
    : new Set(brandOrder.slice(0, limit))

  const idsToResume = products
    .filter(p => p.sync_paused && withinLimit.has(p.brand))
    .map(p => p.id)

  if (idsToResume.length > 0) {
    await admin
      .from('tracked_products')
      .update({ sync_paused: false })
      .in('id', idsToResume)
  }
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
