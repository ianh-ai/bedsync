export const dynamic = 'force-dynamic'

import Stripe from 'stripe'
import stripe from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimit } from '@/lib/plans'

function priceIdToTier(priceId: string): string {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID)     return 'pro'
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
    const newTier = priceIdToTier(priceId)

    // Fetch the user ID before updating so we can check brand overage
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', sub.customer as string)
      .single()

    await admin
      .from('profiles')
      .update({
        stripe_subscription_id: sub.id,
        plan_status:            sub.status,
        plan_tier:              newTier,
        current_period_end:     new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
        pending_plan_tier:      null,
        pending_plan_date:      null,
      })
      .eq('stripe_customer_id', sub.customer as string)

    // Pause excess brands if the user is now over the new plan limit
    const userId = existingProfile?.id
    if (userId) {
      const { data: allActive } = await admin
        .from('tracked_products')
        .select('id, brand, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      const products = (allActive ?? []) as Array<{ id: string; brand: string; created_at: string }>

      // Determine brand order by first appearance (oldest created_at wins)
      const brandOrder: string[] = []
      const brandSet = new Set<string>()
      for (const p of products) {
        if (!brandSet.has(p.brand)) {
          brandSet.add(p.brand)
          brandOrder.push(p.brand)
        }
      }

      const newLimit = getPlanLimit(newTier)
      if (newLimit !== Infinity && brandOrder.length > newLimit) {
        const keepBrands = new Set(brandOrder.slice(0, newLimit))
        const idsToPause = products
          .filter(p => !keepBrands.has(p.brand))
          .map(p => p.id)

        if (idsToPause.length > 0) {
          await admin
            .from('tracked_products')
            .update({ sync_paused: true })
            .in('id', idsToPause)
        }
      }
    }

  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await admin
      .from('profiles')
      .update({
        plan_tier:             'free',
        plan_status:           'inactive',
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
