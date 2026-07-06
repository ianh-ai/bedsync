export const dynamic = 'force-dynamic'

import Stripe from 'stripe'
import stripe from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

function priceIdToTier(priceId: string): string {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return 'business'
  return 'free'
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return Response.json({ error: message }, { status: 400 })
  }

  const admin = createAdminClient()

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object as Stripe.Subscription
    const priceId = sub.items.data[0].price.id
    await admin
      .from('profiles')
      .update({
        stripe_subscription_id: sub.id,
        plan_status: sub.status,
        plan_tier: priceIdToTier(priceId),
        current_period_end: new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
      })
      .eq('stripe_customer_id', sub.customer as string)
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await admin
      .from('profiles')
      .update({
        plan_tier: 'free',
        plan_status: 'inactive',
        stripe_subscription_id: null,
      })
      .eq('stripe_customer_id', sub.customer as string)
  } else if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    await admin
      .from('profiles')
      .update({ plan_status: 'past_due' })
      .eq('stripe_customer_id', invoice.customer as string)
  }

  return Response.json({ received: true })
}
