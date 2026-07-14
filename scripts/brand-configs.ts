import { CATALOG } from '@/lib/catalog'

export type BrandConfig = {
  brand: string
  url: string
  variant_filter: string | null
  // Carried through to scrapeForBrand for parity with the live scrape route —
  // productName disambiguates Tempur-Pedic products that share a page, and
  // apiProductName skips Nectar/Dreamcloud's fuzzy listing match entirely.
  product_name: string
  api_product_name: string | undefined
}

// Derived from lib/catalog.ts rather than hand-maintained so it never drifts
// from what tracked_products.brand/manufacturer_url/variant_filter actually
// store (those are set verbatim from CATALOG entries when a product is added).
const seen = new Set<string>()
export const BRAND_CONFIGS: BrandConfig[] = []

for (const catalogBrand of CATALOG) {
  for (const entry of catalogBrand.products) {
    const variant_filter = entry.variantFilter ?? null
    const key = `${entry.brand}::${entry.url}::${variant_filter ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    BRAND_CONFIGS.push({
      brand: entry.brand,
      url: entry.url,
      variant_filter,
      product_name: entry.name,
      api_product_name: entry.apiProductName,
    })
  }
}
