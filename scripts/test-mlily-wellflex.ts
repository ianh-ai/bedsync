async function main() {
  const url = 'https://mlilyusa.com/products/wellflex-memory-foam-mattress.json'
  const res = await fetch(url)
  const data = await res.json() as { product: { variants: Array<Record<string, unknown>> } }
  const variants = data.product.variants
  console.log(`${variants.length} raw variants:`)
  for (const v of variants) {
    console.log(`  option1=${JSON.stringify(v.option1)} option2=${JSON.stringify(v.option2)} option3=${JSON.stringify(v.option3)} price=${v.price} compare_at_price=${v.compare_at_price}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
