export const dynamic = 'force-dynamic'

import { createRouteClient } from '@/lib/supabase/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPriceId } from '@/lib/plans'
import stripe from '@/lib/stripe'

export async function POST(request: Request) {
  const supabase = createRouteClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id, plan_tier, pending_plan_tier')
      .eq('id', user.id)
      .single()

    console.log('cancel-downgrade — plan_tier:', profile?.plan_tier, 'pending_plan_tier:', profile?.pending_plan_tier)

    const subscriptionId = profile?.stripe_subscription_id as string | null
    const currentTier    = (profile?.plan_tier as string | null) ?? 'starter'
    if (!subscriptionId) return Response.json({ error: 'No active subscription' }, { status: 400 })

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const itemId = subscription.items.data[0].id
    const currentPriceId = getPriceId(currentTier)

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: currentPriceId }],
      proration_behavior: 'none',
    })

    await admin
      .from('profiles')
      .update({ pending_plan_tier: null, pending_plan_date: null })
      .eq('id', user.id)

    return Response.json({ success: true })
  } catch (err: unknown) {
    console.error('Cancel-downgrade route error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
