import { scrapeForBrand } from '../scrape/route'
import { CATALOG } from '@/lib/catalog'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  let body: { brand: string; url: string; variant_filter?: string | null; api_product_name?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { brand, url, variant_filter, api_product_name } = body
  if (!brand || !url) {
    return Response.json({ success: false, error: 'brand and url are required' }, { status: 400 })
  }

  // If api_product_name not provided, look it up from the catalog
  let apiProductName = api_product_name
  if (!apiProductName) {
    const catalogBrand = CATALOG.find(b => b.slug === brand.toLowerCase())
    const catalogEntry = catalogBrand?.products.find(e => e.url === url)
    apiProductName = catalogEntry?.apiProductName
  }

  try {
    const variants = await scrapeForBrand(brand, url, variant_filter ?? null, undefined, apiProductName)
    if (!variants || variants.length === 0) {
      return Response.json({ success: false, error: 'Scraper returned no variants' })
    }
    const sizes = variants.map(v => ({
      title: v.title,
      price: v.price,
      compare_at_price: v.compare_at_price,
    }))
    return Response.json({ success: true, sizes })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ success: false, error: message })
  }
}
