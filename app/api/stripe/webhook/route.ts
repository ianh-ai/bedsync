export const dynamic = 'force-dynamic'

import Stripe from 'stripe'
import stripe from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimit } from '@/lib/plans'

function priceIdToTier(priceId: string): string {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID)  return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID)      return 'pro'
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return 'business'
  return 'free'
}

async function pauseExcessBrands(admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>, userId: string, tier: string) {
  const { data: allActive } = await admin
    .from('tracked_products')
    .select('id, brand, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const products = (allActive ?? []) as Array<{ id: string; brand: string; created_at: string }>

  const brandOrder: string[] = []
  const brandSet = new Set<string>()
  for (const p of products) {
    if (!brandSet.has(p.brand)) {
      brandSet.add(p.brand)
      brandOrder.push(p.brand)
    }
  }

  const newLimit = getPlanLimit(tier)
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

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, pending_plan_tier')
      .eq('stripe_customer_id', sub.customer as string)
      .single()

    console.log('webhook subscription.updated — priceId:', priceId, 'resolved tier:', newTier, 'pending_plan_tier:', existingProfile?.pending_plan_tier)

    const isScheduledDowngrade = Boolean(existingProfile?.pending_plan_tier)

    if (isScheduledDowngrade) {
      // The downgrade route changed the Stripe price but intends it to take
      // effect at period end. Don't update plan_tier yet — only sync metadata.
      await admin
        .from('profiles')
        .update({
          stripe_subscription_id: sub.id,
          plan_status:            sub.status,
          current_period_end:     new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
        })
        .eq('stripe_customer_id', sub.customer as string)
    } else {
      // Immediate change: upgrade, initial subscription, reactivation, etc.
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

      const userId = existingProfile?.id
      if (userId) {
        await pauseExcessBrands(admin, userId, newTier)
      }
    }

  } else if (event.type === 'invoice.payment_succeeded') {
    // Apply a scheduled downgrade when the billing period renews.
    const invoice = event.data.object as Stripe.Invoice
    if ((invoice.billing_reason as string) === 'subscription_cycle') {
      const { data: pendingProfile } = await admin
        .from('profiles')
        .select('id, pending_plan_tier')
        .eq('stripe_customer_id', invoice.customer as string)
        .single()

      if (pendingProfile?.pending_plan_tier) {
        const tierToApply = pendingProfile.pending_plan_tier as string

        await admin
          .from('profiles')
          .update({
            plan_tier:         tierToApply,
            pending_plan_tier: null,
            pending_plan_date: null,
          })
          .eq('stripe_customer_id', invoice.customer as string)

        await pauseExcessBrands(admin, pendingProfile.id as string, tierToApply)
      }
    }

  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await admin
      .from('profiles')
      .update({
        plan_tier:              'free',
        plan_status:            'inactive',
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
