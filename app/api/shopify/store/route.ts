import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Tracked products belong to the user, not the store connection.
  // Deleting the store record leaves all tracked_products rows untouched;
  // they continue to appear in the dashboard and resume syncing once a
  // new store is connected.
  const { error } = await supabase
    .from('shopify_stores')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('[unlink] shopify_stores delete error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
