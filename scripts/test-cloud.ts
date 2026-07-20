import { scrapeForBrand } from '@/lib/scrapers'

async function main() {
  const url = 'https://www.tempurpedic.com/shop-mattresses/tempur-cloud-mattress/'
  try {
    const variants = await scrapeForBrand('tempurpedic', url)
    console.log(`\n${variants.length} size(s):`)
    for (const v of variants) console.log(`  ${v.title}: price=${v.price} compare_at_price=${v.compare_at_price ?? 'null'}`)
  } catch (err) {
    console.log(`FAIL — ${err instanceof Error ? err.message : err}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
