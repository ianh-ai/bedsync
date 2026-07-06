import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAddBrand } from '@/lib/subscription'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { shopify_product_id, shopify_product_title, manufacturer_url, brand, label, price_rule, variant_filter, store_id } = body

  if (!brand || !store_id) {
    return Response.json({ error: 'brand and store_id are required' }, { status: 400 })
  }

  // Enforce brand limit
  const check = await canAddBrand(user.id, brand)
  if (!check.allowed) {
    return Response.json({ error: check.reason ?? 'Not allowed' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Check for a previously soft-deleted product with the same store + brand + label
  const { data: deleted } = await admin
    .from('tracked_products')
    .select('id')
    .eq('store_id', store_id)
    .eq('brand', brand)
    .eq('label', label ?? shopify_product_title ?? '')
    .not('deleted_at', 'is', null)
    .limit(1)
    .single()

  if (deleted) {
    // Restore the soft-deleted row, updating the product ID in case it changed
    const { error } = await admin
      .from('tracked_products')
      .update({
        deleted_at: null,
        shopify_product_id: shopify_product_id ?? null,
        manufacturer_url: manufacturer_url ?? null,
        variant_filter: variant_filter ?? null,
      })
      .eq('id', deleted.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, restored: true })
  }

  // Insert new row
  const { error } = await admin
    .from('tracked_products')
    .insert({
      store_id,
      user_id: user.id,
      shopify_product_id: shopify_product_id ?? null,
      shopify_product_title,
      manufacturer_url,
      brand,
      label: label ?? shopify_product_title,
      price_rule: price_rule ?? 'match_sale',
      variant_filter: variant_filter ?? null,
    })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true, restored: false })
}
