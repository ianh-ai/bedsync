import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get('shop')

  if (!shop || !SHOP_RE.test(shop)) {
    return Response.json(
      { error: 'Missing or invalid shop parameter. Must be a *.myshopify.com domain.' },
      { status: 400 }
    )
  }

  const apiKey = process.env.SHOPIFY_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!apiKey || !appUrl) {
    return Response.json(
      { error: 'SHOPIFY_API_KEY or NEXT_PUBLIC_APP_URL not configured' },
      { status: 500 }
    )
  }

  const nonce = randomBytes(16).toString('hex')
  const callbackUrl = `${appUrl}/api/auth/callback`
  const scopes = 'read_products,write_products'

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${apiKey}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&state=${nonce}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('shopify_oauth_nonce', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
