export const dynamic = 'force-dynamic'

import { createRouteClient } from '@/lib/supabase/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { rotateShopifyToken } from '@/lib/shopify-token-rotation'

export async function POST(request: Request) {
  const supabase = createRouteClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const { data: store } = await admin
      .from('shopify_stores')
      .select('shop_domain')
      .eq('user_id', user.id)
      .single()

    if (!store?.shop_domain) {
      return Response.json({ error: 'No store connected' }, { status: 400 })
    }

    const newToken = await rotateShopifyToken(store.shop_domain as string)
    if (!newToken) {
      return Response.json(
        { error: 'Token rotation failed — please reconnect your store in Settings.' },
        { status: 502 }
      )
    }

    return Response.json({ success: true })
  } catch (err: unknown) {
    console.error('[rotate-token] unhandled error:', err instanceof Error ? err.stack : err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
