import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { shop_domain, access_token, shop_name } = body as {
    shop_domain?: string
    access_token?: string
    shop_name?: string
  }

  if (!shop_domain) {
    return Response.json({ error: 'shop_domain is required' }, { status: 400 })
  }

  const normalizedDomain = shop_domain
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase()

  const { data: existing } = await supabase
    .from('shopify_stores')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // Row exists — update only the fields provided; never touch access_token unless a new one is supplied
    const updateData: Record<string, unknown> = { shop_domain: normalizedDomain }
    if (shop_name !== undefined) updateData.shop_name = shop_name
    if (access_token) updateData.access_token = access_token

    const { error } = await supabase
      .from('shopify_stores')
      .update(updateData)
      .eq('user_id', user.id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
  } else {
    // New row — access_token is required because the column is NOT NULL
    if (!access_token) {
      return Response.json(
        { error: 'Access token required for new connections' },
        { status: 400 }
      )
    }

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      shop_domain: normalizedDomain,
      access_token,
    }
    if (shop_name !== undefined) insertData.shop_name = shop_name

    const { error } = await supabase.from('shopify_stores').insert(insertData)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { sync_schedule?: string }
  const allowed = ['off', 'daily', 'weekly', 'monthly']
  if (!body.sync_schedule || !allowed.includes(body.sync_schedule)) {
    return Response.json({ error: 'Invalid sync_schedule' }, { status: 400 })
  }

  const { error } = await supabase
    .from('shopify_stores')
    .update({ sync_schedule: body.sync_schedule })
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
