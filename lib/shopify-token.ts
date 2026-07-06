import { createAdminClient } from '@/lib/supabase/admin'

export async function getValidShopifyToken(userId: string): Promise<string> {
  const admin = createAdminClient()

  const { data: store } = await admin
    .from('shopify_stores')
    .select('shop_domain, access_token, expires_at, refresh_token, refresh_token_expires_at')
    .eq('user_id', userId)
    .single()

  if (!store) throw new Error('No Shopify store connected')

  const accessToken = store.access_token as string
  const expiresAt = store.expires_at as string | null

  // Non-expiring legacy token — return as-is
  if (!expiresAt) return accessToken

  // Still valid (more than 60s remaining)
  if (new Date(expiresAt).getTime() > Date.now() + 60_000) return accessToken

  // Token is expired or within 60s — attempt refresh
  const refreshToken = store.refresh_token as string | null
  const refreshExpiresAt = store.refresh_token_expires_at as string | null

  if (!refreshToken || (refreshExpiresAt && new Date(refreshExpiresAt).getTime() < Date.now())) {
    throw new Error('Shopify token expired and no valid refresh token — merchant must reconnect')
  }

  const shopDomain = store.shop_domain as string
  const refreshUrl = `https://${shopDomain}/admin/oauth/access_token`

  const res = await fetch(refreshUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY ?? '',
      client_secret: process.env.SHOPIFY_API_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify token refresh failed: ${res.status} — ${text}`)
  }

  const data = await res.json() as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }

  const newAccessToken = data.access_token
  if (!newAccessToken) throw new Error('No access_token in Shopify refresh response')

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null
  const newRefreshToken = data.refresh_token ?? null
  const newRefreshExpiresAt = data.refresh_token_expires_in
    ? new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString()
    : null

  await admin
    .from('shopify_stores')
    .update({
      access_token: newAccessToken,
      expires_at: newExpiresAt,
      refresh_token: newRefreshToken,
      refresh_token_expires_at: newRefreshExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  console.log(`[shopify-token] refreshed token for user ${userId}`)
  return newAccessToken
}
