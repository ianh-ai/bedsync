import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function verifyHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const digestBuf = Buffer.from(digest, 'base64')
  const hmacBuf = Buffer.from(hmacHeader, 'base64')
  return digestBuf.length === hmacBuf.length && timingSafeEqual(digestBuf, hmacBuf)
}

async function handleShopRedact(shopDomain: string) {
  const admin = createAdminClient()

  const { data: store } = await admin
    .from('shopify_stores')
    .select('user_id')
    .eq('shop_domain', shopDomain)
    .single()

  if (!store) {
    console.log(`[shopify/webhook] shop/redact: no store found for shop=${shopDomain}`)
    return
  }

  const userId = store.user_id as string

  const { error: productsError } = await admin
    .from('tracked_products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (productsError) {
    console.error(`[shopify/webhook] shop/redact: failed to soft-delete products for user=${userId}:`, productsError.message)
  } else {
    console.log(`[shopify/webhook] shop/redact: soft-deleted products for user=${userId}`)
  }

  const { error: storeError } = await admin
    .from('shopify_stores')
    .delete()
    .eq('shop_domain', shopDomain)

  if (storeError) {
    console.error(`[shopify/webhook] shop/redact: failed to delete store credentials for shop=${shopDomain}:`, storeError.message)
  } else {
    console.log(`[shopify/webhook] shop/redact: deleted store credentials for shop=${shopDomain}`)
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') ?? ''
  const topic = request.headers.get('x-shopify-topic') ?? ''
  const shopDomain = request.headers.get('x-shopify-shop-domain') ?? ''

  const secret = process.env.SHOPIFY_API_SECRET
  if (!secret) {
    console.error('[shopify/webhook] SHOPIFY_API_SECRET not configured')
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (!hmacHeader || !verifyHmac(rawBody, hmacHeader, secret)) {
    console.warn(`[shopify/webhook] HMAC verification failed — topic=${topic} shop=${shopDomain}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log(`[shopify/webhook] received topic=${topic} shop=${shopDomain}`)

  switch (topic) {
    case 'customers/data_request':
      // Customer requested their data. BedSync stores no customer PII beyond
      // Supabase Auth, so no export action is required.
      console.log(`[shopify/webhook] customers/data_request: acknowledged for shop=${shopDomain}`)
      break

    case 'customers/redact':
      // Customer requested deletion. BedSync stores no customer-level PII.
      console.log(`[shopify/webhook] customers/redact: acknowledged for shop=${shopDomain}`)
      break

    case 'shop/redact':
      // Shop uninstalled — soft-delete tracked products and remove store credentials.
      await handleShopRedact(shopDomain)
      break

    default:
      console.log(`[shopify/webhook] unhandled topic=${topic} shop=${shopDomain}`)
  }

  return new Response(null, { status: 200 })
}
