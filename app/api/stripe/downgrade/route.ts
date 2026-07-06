export const dynamic = 'force-dynamic'

import { createRouteClient } from '@/lib/supabase/route'
import { createAdminClient } from '@/lib/supabase/admin'
import stripe from '@/lib/stripe'

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_STARTER_PRICE_ID  ?? '']: 'starter',
  [process.env.STRIPE_PRO_PRICE_ID      ?? '']: 'pro',
  [process.env.STRIPE_BUSINESS_PRICE_ID ?? '']: 'business',
}

export async function POST(request: Request) {
  const supabase = createRouteClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { newPriceId } = await request.json()
  if (!newPriceId) return Response.json({ error: 'newPriceId required' }, { status: 400 })

  try {
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id, plan_tier')
      .eq('id', user.id)
      .single()

    const subscriptionId = profile?.stripe_subscription_id as string | null
    if (!subscriptionId) return Response.json({ error: 'No active subscription' }, { status: 400 })

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const itemId    = subscription.items.data[0].id
    const periodEnd = subscription.items.data[0].current_period_end

    const newTier     = PRICE_TO_TIER[newPriceId] ?? 'starter'
    const pendingDate = new Date(periodEnd * 1000).toISOString()

    // Write pending fields BEFORE calling Stripe so the webhook sees them when
    // customer.subscription.updated fires immediately after the update below.
    await admin
      .from('profiles')
      .update({ pending_plan_tier: newTier, pending_plan_date: pendingDate })
      .eq('id', user.id)

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'none',
      billing_cycle_anchor: 'unchanged',
    })

    return Response.json({ success: true })
  } catch (err: unknown) {
    console.error('Downgrade route error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
