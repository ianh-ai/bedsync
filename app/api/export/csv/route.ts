import { createClient } from '@/lib/supabase/server'

const SIZES = ['Twin', 'Twin XL', 'Full', 'Queen', 'King', 'Cal King']

function csvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('shopify_stores')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!store) return Response.json({ error: 'No store connected' }, { status: 400 })

  const { data: products } = await supabase
    .from('tracked_products')
    .select('id, label, shopify_product_title')
    .eq('store_id', store.id)
    .is('deleted_at', null)

  const sorted = (products ?? []).sort((a, b) => {
    const nameA = (a.label || a.shopify_product_title || '').toLowerCase()
    const nameB = (b.label || b.shopify_product_title || '').toLowerCase()
    return nameA.localeCompare(nameB)
  })

  const productIds = sorted.map(p => p.id)
  const latestByProductSize: Record<string, Record<string, number>> = {}

  if (productIds.length > 0) {
    const { data: allPrices } = await supabase
      .from('prices')
      .select('tracked_product_id, size, sale_price, scraped_at')
      .in('tracked_product_id', productIds)
      .order('scraped_at', { ascending: false })

    for (const row of (allPrices ?? [])) {
      if (!latestByProductSize[row.tracked_product_id]) {
        latestByProductSize[row.tracked_product_id] = {}
      }
      if (latestByProductSize[row.tracked_product_id][row.size] == null) {
        latestByProductSize[row.tracked_product_id][row.size] = row.sale_price
      }
    }
  }

  const header = ['Mattress', ...SIZES].join(',')
  const rows = sorted.map(p => {
    const name = csvField(p.label || p.shopify_product_title || '')
    const prices = latestByProductSize[p.id] ?? {}
    const cells = SIZES.map(size => {
      const price = prices[size] ?? (size === 'Cal King' ? prices['King'] : undefined)
      return price != null ? String(Math.round(price)) : ''
    })
    return [name, ...cells].join(',')
  })

  const csv = [header, ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="bedsync-prices.csv"',
    },
  })
}
