import { createClient } from '@/lib/supabase/server'
import { scrapeForBrand } from '../scrape/route'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: { brand: string; url: string; name: string; variantFilter?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { brand, url, name, variantFilter } = body
  if (!brand || !url || !name) {
    return Response.json({ ok: false, error: 'Missing required fields: brand, url, name' }, { status: 400 })
  }

  try {
    const scraped = await scrapeForBrand(brand, url, variantFilter ?? null, 1, name)
    const variants = scraped.map(v => ({
      size: v.title,
      sale_price: v.price,
      regular_price: v.compare_at_price,
    }))
    return Response.json({ ok: true, variants })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error })
  }
}
