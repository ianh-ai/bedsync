import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const shop = searchParams.get('shop')
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const hmac = searchParams.get('hmac')

  if (!shop || !code || !state || !hmac) {
    return Response.json({ error: 'Missing required OAuth parameters' }, { status: 400 })
  }

  // --- Validate nonce (CSRF) ---
  const nonceCookie = request.cookies.get('shopify_oauth_nonce')?.value
  if (!nonceCookie || nonceCookie !== state) {
    return Response.json({ error: 'Invalid state parameter — possible CSRF attack' }, { status: 400 })
  }

  // --- Verify HMAC ---
  const secret = process.env.SHOPIFY_API_SECRET
  if (!secret) {
    return Response.json({ error: 'SHOPIFY_API_SECRET not configured' }, { status: 500 })
  }

  const params: Record<string, string> = {}
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'hmac') params[key] = value
  }
  const message = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')

  const digest = createHmac('sha256', secret).update(message).digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  const digestBuf = Buffer.from(digest, 'hex')
  const hmacBuf = Buffer.from(hmac, 'hex')
  const hmacValid =
    digestBuf.length === hmacBuf.length && timingSafeEqual(digestBuf, hmacBuf)

  if (!hmacValid) {
    return Response.json({ error: 'HMAC validation failed' }, { status: 400 })
  }

  // --- Exchange code for access token ---
  const tokenUrl = `https://${shop}/admin/oauth/access_token`
  console.log(`[shopify/callback] POST ${tokenUrl}`)

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: secret,
      code,
      expiring: '1',
    }),
  })

  console.log(`[shopify/callback] token exchange response: ${tokenRes.status}`)

  const tokenBody = await tokenRes.json() as {
    access_token?: string
    scope?: string
    token_type?: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }

  if (!tokenRes.ok) {
    console.error(`[shopify/callback] token exchange failed: ${tokenRes.status}`, JSON.stringify(tokenBody))
    return Response.json(
      { error: `Token exchange failed: ${tokenRes.status}`, detail: tokenBody },
      { status: 502 }
    )
  }

  const { access_token, scope, token_type, expires_in, refresh_token, refresh_token_expires_in } = tokenBody
  console.log('[oauth:callback]', JSON.stringify({
    scope,
    token_type,
    expires_in: expires_in ?? 'none',
    prefix: access_token?.slice(0, 12),
    refresh_token_prefix: refresh_token?.slice(0, 12) ?? 'none',
  }))

  if (!access_token) {
    throw new Error(
      `access_token missing from Shopify response (status ${tokenRes.status}): ${JSON.stringify(tokenBody)}`
    )
  }

  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null
  const refreshTokenExpiresAt = refresh_token_expires_in
    ? new Date(Date.now() + refresh_token_expires_in * 1000).toISOString()
    : null

  // --- Get current Supabase user ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // User's session expired during OAuth flow — send them to login
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('shopify_oauth_nonce')
    return response
  }

  // --- Upsert store credentials ---
  const { error: upsertError } = await supabase
    .from('shopify_stores')
    .upsert(
      {
        user_id: user.id,
        shop_domain: shop,
        access_token,
        expires_at: expiresAt,
        refresh_token: refresh_token ?? null,
        refresh_token_expires_at: refreshTokenExpiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    return Response.json({ error: upsertError.message }, { status: 500 })
  }

  // --- Clear nonce cookie and redirect ---
  const successUrl = new URL('/dashboard/products', request.url)
  const response = NextResponse.redirect(successUrl)
  response.cookies.delete('shopify_oauth_nonce')

  return response
}
