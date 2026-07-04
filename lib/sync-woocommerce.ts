type PriceBySize = Record<string, { regular_price: number; sale_price: number | null }>

export type WooSyncResult = {
  updated: number
  skipped: number
  errors: string[]
}

function findSizeForOption(option: string): string | null {
  const o = option.toLowerCase()
  if (o.includes('cal king') || o.includes('california king')) return 'Cal King'
  if (o.includes('twin xl') || o.includes('twin extra long') || o.includes('txl')) return 'Twin XL'
  if (o.includes('twin')) return 'Twin'
  if (o.includes('full') || o.includes('double')) return 'Full'
  if (o.includes('queen')) return 'Queen'
  if (o.includes('king')) return 'King'
  return null
}

function basicAuth(key: string, secret: string): string {
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

export async function syncWooCommerce({
  storeUrl,
  consumerKey,
  consumerSecret,
  productId,
  priceBySize,
}: {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
  productId: string
  priceBySize: PriceBySize
}): Promise<WooSyncResult> {
  const auth = basicAuth(consumerKey, consumerSecret)
  const base = storeUrl.replace(/\/$/, '')
  const errors: string[] = []
  let updated = 0
  let skipped = 0

  const variationsUrl = `${base}/wp-json/wc/v3/products/${productId}/variations?per_page=100`
  console.log(`[wc-sync] GET ${variationsUrl}`)
  const variationsRes = await fetch(variationsUrl, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  })
  if (!variationsRes.ok) {
    const text = await variationsRes.text()
    throw new Error(`WooCommerce variations fetch failed: ${variationsRes.status} — ${text.slice(0, 200)}`)
  }

  const variations = await variationsRes.json() as Array<{
    id: number
    attributes: Array<{ name: string; option: string }>
  }>
  console.log(`[wc-sync] ${variations.length} variation(s) fetched`)

  for (const variation of variations) {
    const sizeAttr = variation.attributes.find(a => a.name.toLowerCase().includes('size'))
    if (!sizeAttr) {
      console.log(`[wc-sync] variation ${variation.id} — no size attribute, skipping`)
      skipped++
      continue
    }

    const matchedSize = findSizeForOption(sizeAttr.option)
    if (!matchedSize || !priceBySize[matchedSize]) {
      console.log(`[wc-sync] variation ${variation.id} attr="${sizeAttr.option}" — no price match, skipping`)
      skipped++
      continue
    }

    const { regular_price, sale_price } = priceBySize[matchedSize]
    // regular_price can be null at runtime even though the type says number
    const wcRegular = regular_price != null ? regular_price.toFixed(2) : sale_price!.toFixed(2)
    const wcSale = regular_price != null && sale_price != null ? sale_price.toFixed(2) : ''

    const putUrl = `${base}/wp-json/wc/v3/products/${productId}/variations/${variation.id}`
    console.log(`[wc-sync] PUT ${putUrl} — size="${matchedSize}" regular=${wcRegular} sale=${wcSale || '(clear)'}`)

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ regular_price: wcRegular, sale_price: wcSale }),
    })

    if (!putRes.ok) {
      const text = await putRes.text()
      const msg = `variation ${variation.id} (${matchedSize}): PUT failed ${putRes.status} — ${text.slice(0, 200)}`
      console.error(`[wc-sync] ${msg}`)
      errors.push(msg)
    } else {
      console.log(`[wc-sync] variation ${variation.id} (${matchedSize}) updated`)
      updated++
    }
  }

  console.log(`[wc-sync] done — updated=${updated} skipped=${skipped} errors=${errors.length}`)
  return { updated, skipped, errors }
}
