import { createClient } from '@/lib/supabase/server'

async function getProductForUser(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from('tracked_products')
    .select('id, store_id, shopify_stores!inner(user_id)')
    .eq('id', id)
    .single()
  if (!data) return null
  const store = data.shopify_stores as unknown as { user_id: string }
  if (store.user_id !== userId) return null
  return data
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await getProductForUser(supabase, id, user.id)
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const allowed = ['label', 'manufacturer_url', 'shopify_product_id', 'brand', 'price_rule', 'markup_value', 'variant_filter', 'guardrails']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] ?? null
  }

  const { error } = await supabase.from('tracked_products').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await getProductForUser(supabase, id, user.id)
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 })

  // Delete price history first (FK constraint), then the product
  await supabase.from('prices').delete().eq('tracked_product_id', id)
  const { error } = await supabase.from('tracked_products').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
