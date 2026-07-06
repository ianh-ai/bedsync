export const dynamic = 'force-dynamic'

import { createRouteClient } from '@/lib/supabase/route'
import { createAdminClient } from '@/lib/supabase/admin'
import stripe from '@/lib/stripe'

export async function POST(request: Request) {
  const supabase = createRouteClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .single()

    const subscriptionId = profile?.stripe_subscription_id as string | null
    if (!subscriptionId) return Response.json({ error: 'No active subscription' }, { status: 400 })

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })

    await admin
      .from('profiles')
      .update({ plan_status: 'canceling' })
      .eq('id', user.id)

    return Response.json({ success: true })
  } catch (err: unknown) {
    console.error('Cancel route error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
