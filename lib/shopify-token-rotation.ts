import { createAdminClient } from '@/lib/supabase/admin'

export async function rotateShopifyToken(shopDomain: string): Promise<string | null> {
  const admin = createAdminClient()

  const { data: store } = await admin
    .from('shopify_stores')
    .select('access_token')
    .eq('shop_domain', shopDomain)
    .single()

  if (!store?.access_token) {
    console.error(`[token-rotation] no store or token found for ${shopDomain}`)
    return null
  }

  const currentToken = store.access_token as string
  const rotateUrl = `https://${shopDomain}/admin/oauth/access_token/rotate`

  console.log(`[token-rotation] POST ${rotateUrl}`)

  let rotateRes: Response
  let rotateBody: unknown
  try {
    rotateRes = await fetch(rotateUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': currentToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        access_token: currentToken,
      }),
    })
    rotateBody = await rotateRes.json().catch(() => null)
  } catch (err) {
    console.error(`[token-rotation] fetch failed for ${shopDomain}:`, err instanceof Error ? err.message : err)
    return null
  }

  console.log(`[token-rotation] ${shopDomain} response: ${rotateRes.status}`, JSON.stringify(rotateBody))

  if (!rotateRes.ok) {
    console.error(`[token-rotation] rotation failed for ${shopDomain}: HTTP ${rotateRes.status}`)
    return null
  }

  const newToken = (rotateBody as { access_token?: string })?.access_token
  if (!newToken) {
    console.error(`[token-rotation] no access_token in rotation response for ${shopDomain}`)
    return null
  }

  const { error: updateError } = await admin
    .from('shopify_stores')
    .update({ access_token: newToken })
    .eq('shop_domain', shopDomain)

  if (updateError) {
    console.error(`[token-rotation] DB update failed for ${shopDomain}:`, updateError.message)
    return null
  }

  console.log(`[token-rotation] token successfully rotated for ${shopDomain}`)
  return newToken
}
