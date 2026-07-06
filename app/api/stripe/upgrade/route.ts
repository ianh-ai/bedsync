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
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .single()

    const subscriptionId = profile?.stripe_subscription_id as string | null
    if (!subscriptionId) return Response.json({ error: 'No active subscription' }, { status: 400 })

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const itemId = subscription.items.data[0].id

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    })

    const newTier = PRICE_TO_TIER[newPriceId] ?? 'pro'
    await admin
      .from('profiles')
      .update({ plan_tier: newTier })
      .eq('id', user.id)

    return Response.json({ success: true })
  } catch (err: unknown) {
    console.error('Upgrade route error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
