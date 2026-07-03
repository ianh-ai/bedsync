import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const removeProducts = new URL(request.url).searchParams.get('removeProducts') === 'true'

  const { data: store } = await supabase
    .from('shopify_stores')
    .select('id, shop_domain')
    .eq('user_id', user.id)
    .single()

  console.log(`[unlink] store: id=${store?.id} domain=${store?.shop_domain} removeProducts=${removeProducts}`)

  if (removeProducts && store?.id) {
    const { error: productsError, count } = await supabase
      .from('tracked_products')
      .delete({ count: 'exact' })
      .eq('store_id', store.id)
    if (productsError) {
      console.error(`[unlink] tracked_products delete error:`, productsError.message)
      return Response.json({ error: productsError.message }, { status: 500 })
    }
    console.log(`[unlink] deleted ${count} tracked_products`)
  }

  const { error } = await supabase
    .from('shopify_stores')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error(`[unlink] shopify_stores delete error:`, error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  console.log(`[unlink] done — store removed, products ${removeProducts ? 'deleted' : 'preserved (store_id set to null by FK)'}`)
  return Response.json({ success: true })
}
