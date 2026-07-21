import { scrapeForBrand } from '@/lib/scrapers'

const URLS: Array<{ label: string; url: string }> = [
  { label: 'Aurora Luxe', url: 'https://brooklynbedding.com/products/aurora?variant=44513190740013' },
  { label: 'Signature Hybrid', url: 'https://brooklynbedding.com/products/signature-hybrid?variant=44510100783149' },
  { label: 'Plank Firm', url: 'https://brooklynbedding.com/products/plank?variant=40397033078829' },
]

async function main() {
  for (const { label, url } of URLS) {
    console.log(`\n=== ${label} — ${url} ===`)
    try {
      const variants = await scrapeForBrand('brooklynbedding', url)
      console.log(`${variants.length} size(s):`)
      for (const v of variants) console.log(`  ${v.title}: price=${v.price} compare_at_price=${v.compare_at_price ?? 'null'}`)
    } catch (err) {
      console.log(`FAIL — ${err instanceof Error ? err.message : err}`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
