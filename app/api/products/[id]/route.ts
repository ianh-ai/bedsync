import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserProfile, resumeBrandsWithinLimit } from '@/lib/subscription'

async function getProductForUser(id: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tracked_products')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()
  return data ?? null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await getProductForUser(id, user.id)
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const allowed = ['label', 'manufacturer_url', 'shopify_product_id', 'brand', 'price_rule', 'price_mode', 'markup_value', 'markup_type', 'variant_filter', 'guardrails', 'guardrail_min', 'guardrail_max']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] ?? null
  }

  const admin = createAdminClient()
  const { error } = await admin.from('tracked_products').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await getProductForUser(id, user.id)
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('tracked_products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Un-pause brands that now fall within the plan limit after this brand slot freed up.
  const profile = await getUserProfile(user.id)
  if (profile) {
    await resumeBrandsWithinLimit(user.id, profile.plan_tier)
  }

  return Response.json({ success: true })
}
