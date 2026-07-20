import { scrapeForBrand } from '@/lib/scrapers'

const URLS: Record<string, string> = {
  adapt: 'https://www.tempurpedic.com/shop-mattresses/adapt-collection/v/4120/',
  proadapt: 'https://www.tempurpedic.com/shop-mattresses/adapt-collection/v/4186/',
  luxeadapt: 'https://www.tempurpedic.com/shop-mattresses/adapt-collection/v/4201/',
}

async function main() {
  const key = process.argv[2]
  const url = URLS[key]
  if (!url) {
    console.log(`Usage: ts-node test-adapt.ts <${Object.keys(URLS).join('|')}>`)
    process.exit(1)
  }
  console.log(`=== ${key} — ${url} ===`)
  try {
    const variants = await scrapeForBrand('tempurpedic', url)
    console.log(`${variants.length} size(s):`)
    for (const v of variants) console.log(`  ${v.title}: price=${v.price} compare_at_price=${v.compare_at_price ?? 'null'}`)
  } catch (err) {
    console.log(`FAIL — ${err instanceof Error ? err.message : err}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
