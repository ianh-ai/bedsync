import { createClient } from '@/lib/supabase/server'

function basicAuth(key: string, secret: string): string {
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: { storeUrl: string; consumerKey: string; consumerSecret: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { storeUrl, consumerKey, consumerSecret } = body
  if (!storeUrl || !consumerKey || !consumerSecret) {
    return Response.json({ ok: false, error: 'storeUrl, consumerKey, and consumerSecret are required' }, { status: 400 })
  }

  const base = storeUrl.replace(/\/$/, '')
  const testUrl = `${base}/wp-json/wc/v3/system_status`
  console.log(`[connect-woocommerce] Testing credentials: GET ${testUrl}`)

  let testRes: Response
  try {
    testRes = await fetch(testUrl, {
      headers: { Authorization: basicAuth(consumerKey, consumerSecret), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: `Could not reach store: ${msg}` })
  }

  if (!testRes.ok) {
    const text = await testRes.text()
    console.error(`[connect-woocommerce] Credential test failed: ${testRes.status} — ${text.slice(0, 200)}`)
    return Response.json({ ok: false, error: `Credential check failed (HTTP ${testRes.status}). Verify your store URL and API keys.` })
  }

  const { error: upsertError } = await supabase
    .from('shopify_stores')
    .upsert(
      {
        user_id: user.id,
        platform: 'woocommerce',
        shop_domain: base,
        wc_consumer_key: consumerKey,
        wc_consumer_secret: consumerSecret,
        access_token: '',
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error(`[connect-woocommerce] DB upsert failed:`, upsertError.message)
    return Response.json({ ok: false, error: upsertError.message })
  }

  console.log(`[connect-woocommerce] Connected: user=${user.id} store=${base}`)
  return Response.json({ ok: true })
}
