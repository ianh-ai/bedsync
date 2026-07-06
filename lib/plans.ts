export const PLAN_LIMITS: Record<string, number> = {
  free: 0,
  starter: 2,
  pro: 5,
  business: Infinity,
}

export function getPlanLimit(tier: string): number {
  return PLAN_LIMITS[tier] ?? 0
}

export function getPriceId(tier: string): string {
  const map: Record<string, string | undefined> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
    business: process.env.STRIPE_BUSINESS_PRICE_ID,
  }
  const id = map[tier]
  if (!id) throw new Error(`No price ID configured for tier: ${tier}`)
  return id
}
