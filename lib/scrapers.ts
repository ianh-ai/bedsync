import { load } from 'cheerio'
import { chromium, type Browser, type Page, type Locator } from 'playwright'

export type ScrapedVariant = {
  title: string
  price: number           // current/sale price (what consumers pay)
  compare_at_price: number | null  // MSRP/list price (strikethrough), or null if no sale
}

export function normalizeSize(title: string): string | null {
  const t = title.toLowerCase()
  if (t.includes('split')) return null  // Split King / Split CA King → not a standard size
  if (t.includes('cal king') || t.includes('cal. king') || t.includes('ca king') || t.includes('california king') || t.includes('calking')) return 'Cal King'
  if (t.includes('twin xl') || t.includes('twin x') || t.includes('twinxl')) return 'Twin XL'
  if (t.includes('twin')) return 'Twin'
  if (t.includes('full')) return 'Full'
  if (t.includes('queen')) return 'Queen'
  if (t.includes('king')) return 'King'
  return null
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
}

// Shopify exposes every variant (including price/compare_at_price) at
// {origin}/products/{handle}.json with no JS rendering needed. Trying this
// before the browser-based scraper avoids the DOM-heuristic failure modes
// (invisible sticky bars, popovers, slow-loading pages) that hit Casper,
// Birch, WinkBeds, Puffy, and Bear — modeled on tryHelixJsonEndpoints.
async function tryShopifyProductJson(url: string): Promise<ScrapedVariant[] | null> {
  const urlObj = new URL(url)
  const handleMatch = url.match(/\/products\/([^/?#]+)/)
  if (!handleMatch) return null
  const handle = handleMatch[1]
  const jsonUrl = `${urlObj.origin}/products/${handle}.json`

  console.log(`[scrape:shopify] Trying ${jsonUrl}`)
  try {
    const res = await fetch(jsonUrl, {
      headers: { ...BROWSER_HEADERS, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    console.log(`[scrape:shopify] HTTP ${res.status}`)
    if (!res.ok) return null

    const data = await res.json() as Record<string, unknown>
    const product = data.product as Record<string, unknown> | undefined
    const variants = Array.isArray(product?.variants)
      ? product!.variants as Array<Record<string, unknown>>
      : []

    if (variants.length === 0) {
      console.log(`[scrape:shopify] No variants in response`)
      return null
    }

    // Detect which option column (option1/option2/option3) holds the mattress size
    const optionKeys = ['option1', 'option2', 'option3']
    let sizeKey: string | null = null
    for (const key of optionKeys) {
      if (variants.some(v => normalizeSize(String(v[key] ?? '')) != null)) {
        sizeKey = key
        break
      }
    }

    if (!sizeKey) {
      console.log(`[scrape:shopify] No option column has recognizable size names`)
      return null
    }
    console.log(`[scrape:shopify] Size key: ${sizeKey}`)

    const results: ScrapedVariant[] = []
    const seenSizes = new Set<string>()
    for (const v of variants) {
      const size = normalizeSize(String(v[sizeKey] ?? ''))
      if (!size || seenSizes.has(size)) continue
      seenSizes.add(size)

      const price = parseFloat(String(v.price ?? '0'))
      const compareAtRaw = v.compare_at_price  // null or a string like "1599.00"
      const compareAt = compareAtRaw != null ? parseFloat(String(compareAtRaw)) : null

      if (isNaN(price) || price <= 0) continue
      const hasRealSale = compareAt != null && !isNaN(compareAt) && compareAt > price

      console.log(`[scrape:shopify] size="${size}" price=${price} compareAt=${compareAt ?? 'null'} hasSale=${hasRealSale}`)
      results.push({
        title: size,
        price,
        compare_at_price: hasRealSale ? compareAt : null,
      })
    }

    if (results.length < 2) {
      console.log(`[scrape:shopify] Only ${results.length} recognizable size(s) — too few, returning null`)
      return null
    }

    console.log(`[scrape:shopify] ✓ ${results.length} size(s) via Shopify product JSON`)
    return results
  } catch (err) {
    console.log(`[scrape:shopify] Failed:`, err instanceof Error ? err.message : err)
    return null
  }
}

async function residentHomeFetch(url: string): Promise<Response> {
  // The ResidentHome JSON API works via direct fetch — no bot protection needed.
  // Only fall back to ScraperAPI if the direct request is rate-limited (403/429).
  try {
    const direct = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(10_000),
    })
    if (direct.status !== 403 && direct.status !== 429) return direct
    console.log(`[scrape:nectar] Direct fetch returned ${direct.status} — falling back to ScraperAPI`)
  } catch (e) {
    console.log(`[scrape:nectar] Direct fetch failed:`, e instanceof Error ? e.message : e)
  }

  if (!process.env.SCRAPER_API_KEY) throw new Error('SCRAPER_API_KEY not set and direct fetch failed')
  const scraperUrl = `https://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&render=false`
  const res = await fetch(scraperUrl)
  if (res.status !== 403) return res
  console.log(`[scrape:nectar] 403 from residenthome via ScraperAPI — waiting 3s and retrying: ${url}`)
  await new Promise(r => setTimeout(r, 3000))
  const retry = await fetch(scraperUrl)
  if (retry.status === 403) throw new Error('Rate limited by residenthome API — try again in a few seconds.')
  return retry
}

async function scrapeNectar(url: string, variantFilter?: string | null, apiBrand = 'nectar', apiProductName?: string): Promise<ScrapedVariant[]> {
  const urlObj = new URL(url)
  const slug = urlObj.pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  console.log(`[scrape:nectar] url="${url}" apiBrand="${apiBrand}" slug="${slug}" variant_filter="${variantFilter ?? 'none'}" apiProductName="${apiProductName ?? 'none'}"`)

  const JUNK_WORDS = ['flatpack', 'sams-club', 'samsclub', 'test', 'accidental', 'coverage', 'case-pack', 'extend', 'dummy', 'gwp']

  // ── Step 1: fetch product listing, filter junk, score-match best name ────────
  // Scored names in descending order so we can try next-best on validation failure
  const scoredNames: Array<{ name: string; score: number }> = []

  if (apiProductName) {
    // Skip listing fetch and scoring — use the exact API product name directly
    console.log(`[scrape:nectar] Using apiProductName="${apiProductName}" — skipping listing/scoring`)
    scoredNames.push({ name: apiProductName, score: Infinity })
  } else {
    try {
      const listingUrl = `https://api.residenthome.com/products?lang=en&brand=${apiBrand}&limit=200`
      console.log(`[scrape:nectar] Listing GET ${listingUrl}`)
      const listingRes = await residentHomeFetch(listingUrl)
      console.log(`[scrape:nectar] Listing status: ${listingRes.status}`)

      if (listingRes.ok) {
        const listingJson = await listingRes.json() as Record<string, unknown>
        const listResult = listingJson.result as Record<string, unknown> | undefined
        const data: unknown[] =
          (Array.isArray(listResult?.data) ? listResult!.data as unknown[] : null) ??
          (Array.isArray(listingJson.data) ? listingJson.data as unknown[] : null) ??
          (Array.isArray(listingJson.products) ? listingJson.products as unknown[] : null) ??
          (Array.isArray(listingJson.results) ? listingJson.results as unknown[] : null) ??
          (Array.isArray(listingJson) ? listingJson as unknown[] : [])

        const allNames = data
          .map(p => String((p as Record<string, unknown>).name ?? (p as Record<string, unknown>).slug ?? ''))
          .filter(Boolean)

        // Remove internal/non-retail SKUs
        const retailNames = allNames.filter(name => {
          const n = name.toLowerCase()
          return !JUNK_WORDS.some(junk => n.includes(junk))
        })
        console.log('[scrape:nectar] Retail products (after junk filter):', JSON.stringify(retailNames))

        // Score each name: count matching URL slug parts + variantFilter words
        const keywords = [
          ...slug.split('-').filter(w => w.length > 2),
          ...(variantFilter ? variantFilter.toLowerCase().split(/\s+/) : []),
        ]
        for (const name of retailNames) {
          const nameLower = name.toLowerCase()
          const score = keywords.filter(kw => nameLower.includes(kw)).length
          scoredNames.push({ name, score })
        }
        scoredNames.sort((a, b) => b.score - a.score)
        console.log(`[scrape:nectar] Top matches:`, JSON.stringify(scoredNames.slice(0, 5)))
      }
    } catch (err) {
      console.log('[scrape:nectar] Listing error:', (err as Error).message)
    }
  }

  if (scoredNames.length === 0) {
    console.log('[scrape:nectar] No retail products found in listing')
    return []
  }

  // ── Step 2: fetch matched product, validating and falling back on failure ─────
  let productJson: Record<string, unknown> | null = null
  let chosenName = ''

  for (const { name, score } of scoredNames) {
    const productUrl = `https://api.residenthome.com/products?name=${encodeURIComponent(name)}&lang=en&brand=${apiBrand}`
    console.log(`[scrape:nectar] Product GET ${productUrl} (score=${score})`)

    let json: Record<string, unknown>
    try {
      const res = await residentHomeFetch(productUrl)
      if (!res.ok) { console.log(`[scrape:nectar] Non-OK (${res.status}) for "${name}", trying next`); continue }
      json = await res.json() as Record<string, unknown>
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('Rate limited')) throw err
      console.log(`[scrape:nectar] Fetch error for "${name}":`, msg)
      continue
    }

    const resultObj = json.result as Record<string, unknown> | undefined
    const dataArr: unknown[] =
      (Array.isArray(resultObj?.data) ? resultObj!.data as unknown[] : null) ??
      (Array.isArray(json.data) ? json.data as unknown[] : null) ??
      (Array.isArray(json.products) ? json.products as unknown[] : null) ??
      []

    if (dataArr.length === 0) { console.log(`[scrape:nectar] Empty data for "${name}", trying next`); continue }

    const candidate = dataArr[0] as Record<string, unknown>

    if (String(candidate.status ?? '').toLowerCase() === 'inactive') {
      console.log(`[scrape:nectar] WARNING: "${name}" status=inactive — trying next`)
      continue
    }

    const baseCents = ((candidate.pricing as Record<string, unknown> | undefined)?.price as Record<string, unknown> | undefined)?.amount
    if (baseCents === 0) {
      console.log(`[scrape:nectar] ERROR: base price is $0 — likely wrong product matched, skipping "${name}"`)
      continue
    }

    console.log(`[scrape:nectar] Product response (first 3000 chars): ${JSON.stringify(json).slice(0, 3000)}`)
    productJson = json
    chosenName = name
    break
  }

  if (!productJson) {
    console.log('[scrape:nectar] No valid product found after trying all candidates')
    return []
  }
  console.log(`[scrape:nectar] Using product: "${chosenName}"`)

  // Log hidden fields that may contain MSRP; also try &include= variants
  const resultObj2 = productJson.result as Record<string, unknown> | undefined
  const dataArr: unknown[] =
    (Array.isArray(resultObj2?.data) ? resultObj2!.data as unknown[] : null) ??
    (Array.isArray(productJson.data) ? productJson.data as unknown[] : null) ??
    (Array.isArray(productJson.products) ? productJson.products as unknown[] : null) ??
    []

  // ── Step 3: inspect price structure ─────────────────────────────────────────

  if (dataArr.length === 0) {
    console.log('[scrape:nectar] No data array in product response')
    return []
  }

  const product = dataArr[0] as Record<string, unknown>
  console.log('[scrape:nectar] data[0] keys:', Object.keys(product))

  // Log hidden fields and try &include= variants to find MSRP
  console.log('[scrape:nectar] data[0].configuration:', JSON.stringify(product.configuration ?? null).slice(0, 2000))
  console.log('[scrape:nectar] data[0].skuData:', JSON.stringify(product.skuData ?? null).slice(0, 2000))
  for (const include of ['pricing', 'all']) {
    const incUrl = `https://api.residenthome.com/products?name=${encodeURIComponent(chosenName)}&lang=en&brand=${apiBrand}&include=${include}`
    console.log(`[scrape:nectar] Trying ${incUrl}`)
    try {
      const incRes = await residentHomeFetch(incUrl)
      console.log(`[scrape:nectar] &include=${include}: HTTP ${incRes.status}`)
      if (incRes.ok) console.log(`[scrape:nectar] &include=${include} body (first 3000):`, (await incRes.text()).slice(0, 3000))
    } catch (e) { console.log(`[scrape:nectar] &include=${include} error:`, (e as Error).message) }
  }

  // ── Step 3: extract pricing from known structure ─────────────────────────────
  // pricing.price.amount   = current/sale price in cents (base/Twin size)
  // pricing.listPrice.amount = list/regular price in cents
  const pricingObj = product.pricing as Record<string, unknown> | undefined
  console.log('[scrape:nectar] pricing object:', JSON.stringify(pricingObj ?? null).slice(0, 1000))

  const basePriceCents = (pricingObj?.price as Record<string, unknown> | undefined)?.amount
  // API uses different field names depending on the brand; check all known variants
  const listPriceCents =
    (pricingObj?.listPrice as Record<string, unknown> | undefined)?.amount ??
    (pricingObj?.compareAtPrice as Record<string, unknown> | undefined)?.amount ??
    (pricingObj?.originalPrice as Record<string, unknown> | undefined)?.amount ??
    (pricingObj?.msrp as Record<string, unknown> | undefined)?.amount ??
    null
  console.log('[scrape:nectar] pricing keys:', Object.keys(pricingObj ?? {}), 'listPriceCents=', listPriceCents)

  if (typeof basePriceCents !== 'number') {
    console.log('[scrape:nectar] pricing.price.amount missing or not a number')
    return []
  }

  const isOnSale = typeof listPriceCents === 'number' && listPriceCents > basePriceCents
  // Note: basePriceCents is the API's "current price" for the base size (usually Twin).
  // If basePriceCents looks wrong (e.g. matches list/MSRP rather than sale price),
  // the API may not expose the promotional price — check pricing.price vs pricing.listPrice.
  console.log(`[scrape:nectar] basePriceCents=${basePriceCents} ($${(basePriceCents/100).toFixed(2)}) listPriceCents=${listPriceCents ?? 'null'} isOnSale=${isOnSale}`)

  // Size options: product.properties → find entry with name="Size" → .options[]
  const properties = product.properties as Array<Record<string, unknown>> | undefined
  const sizeProp = Array.isArray(properties)
    ? properties.find(p => String(p.name ?? '').toLowerCase() === 'size')
    : undefined
  const sizeOptions = Array.isArray(sizeProp?.options)
    ? sizeProp!.options as Array<Record<string, unknown>>
    : []

  console.log(`[scrape:nectar] Size options (${sizeOptions.length}):`, JSON.stringify(sizeOptions).slice(0, 800))

  if (sizeOptions.length === 0) {
    console.log('[scrape:nectar] No size options found in product.properties')
    return []
  }

  // ── Step 4: build ScrapedVariant[] ────────────────────────────────────────
  let results: ScrapedVariant[] = []
  for (const opt of sizeOptions) {
    const rawTitle = String(opt.title ?? opt.name ?? opt.label ?? opt.value ?? '')
    const size = normalizeSize(rawTitle)
    if (!size) {
      console.log(`[scrape:nectar] Unrecognized size label "${rawTitle}"`)
      continue
    }

    const priceDiff = typeof opt.priceDiff === 'number' ? opt.priceDiff : 0
    const saleCents = basePriceCents + priceDiff
    const regularCents = isOnSale ? (listPriceCents as number) + priceDiff : null

    const salePrice = saleCents / 100
    const regularPrice = regularCents != null ? regularCents / 100 : null

    console.log(`[scrape:nectar] size="${size}" priceDiff=${priceDiff} (basePriceCents${priceDiff >= 0 ? '+' : ''}${priceDiff}=${saleCents}) sale=$${salePrice.toFixed(2)} regular=${regularPrice != null ? `$${regularPrice.toFixed(2)}` : 'null'}`)
    results.push({
      title: size,
      price: salePrice,
      compare_at_price: regularPrice,  // null when not on sale (listPrice == price)
    })
  }

  console.log(`[scrape:nectar] API extracted ${results.length} size(s) (compare_at all null: ${results.every(r => r.compare_at_price == null)})`)

  // ── Step 5: HTML fallback for MSRP/regular price ──────────────────────────────
  // Resident Home API always returns listPrice === price during active sales.
  // Scrape the manufacturer page to find the crossed-out regular price.
  if (results.length > 0 && results.every(r => r.compare_at_price == null)) {
    console.log(`[scrape:nectar] API has no MSRP data — scraping HTML: ${url}`)
    try {
      const htmlRes = await fetch(url, { headers: { ...BROWSER_HEADERS, Referer: urlObj.origin + '/' } })
      if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status}`)
      const html = await htmlRes.text()
      const $n = load(html)
      console.log(`[scrape:nectar] HTML size: ${html.length} bytes`)

      const salePriceBySize = new Map(results.map(r => [r.title, r.price]))

      // --- A: inline scripts with compare/list/was/msrp price data ---
      const inlineScripts = $n('script:not([src])').toArray()
      const priceTermRe = /compare|originalPrice|wasPrice|msrp|listPrice|list_price|regular_price/i
      const scriptMsrpCandidates: number[] = []

      for (const el of inlineScripts) {
        const src = $n(el).text().trim()
        if (!priceTermRe.test(src)) continue
        console.log(`[scrape:nectar] Script with price terms (length=${src.length}):`, src.slice(0, 600))

        // Extract numeric values after known MSRP field names
        const fieldRe = /"(?:listPrice|compareAtPrice|compare_at_price|originalPrice|wasPrice|msrp|regularPrice|was_price|regular_price)"\s*:\s*"?(\d+(?:\.\d+)?)"?/g
        for (const m of src.matchAll(fieldRe)) {
          const raw = parseFloat(m[1] ?? '0')
          const dollars = raw > 10000 ? raw / 100 : raw  // handle cents vs dollars
          if (dollars > 200) {
            console.log(`[scrape:nectar] Script MSRP field: ${m[0].slice(0, 80)} → $${dollars}`)
            scriptMsrpCandidates.push(dollars)
          }
        }
      }

      // --- B: struck-through / compare-at DOM elements ---
      const STRIKE_SEL = [
        '.was-price', '.original-price', '.compare-at-price', '.compare-at',
        '[class*="was-price"]', '[class*="compare-at"]', '[class*="original-price"]',
        '[class*="msrp"]', '[class*="regular-price"]', '[class*="strikethrough"]',
        '[style*="line-through"]', 'del', 's',
      ].join(',')

      const strikeAmounts: number[] = []
      $n(STRIKE_SEL).each((_, el) => {
        const m = $n(el).text().match(/\$([\d,]+(?:\.\d{2})?)/)
        if (m) {
          const p = parseFloat(m[1].replace(/,/g, ''))
          if (p > 200) strikeAmounts.push(p)
        }
      })
      console.log(`[scrape:nectar] Struck-through prices:`, strikeAmounts)

      // --- C: "Was $X" / "Regular $X" / "MSRP $X" text patterns in raw HTML ---
      const wasRe = /\b(?:was|regular|orig(?:inal)?|msrp|list\s+price)\b[:\s]*\$([\d,]+(?:\.\d{2})?)/gi
      const wasAmounts = [...html.matchAll(wasRe)]
        .map(m => parseFloat((m[1] ?? '').replace(/,/g, '')))
        .filter(p => p > 200)
      console.log(`[scrape:nectar] "Was/Regular/MSRP $X" amounts:`, wasAmounts)

      // --- D: size keyword + price pair scan (600-char window around each keyword) ---
      const SIZE_KEYWORDS: Array<[string, string]> = [
        ['California King', 'Cal King'], ['Cal King', 'Cal King'], ['Twin XL', 'Twin XL'],
        ['Twin', 'Twin'], ['Full', 'Full'], ['Queen', 'Queen'], ['King', 'King'],
      ]
      const WINDOW = 600
      const dollarRe = /\$\s*([\d,]+(?:\.\d{2})?)/g
      const msrpBySize = new Map<string, number>()

      for (const [keyword, canonicalSize] of SIZE_KEYWORDS) {
        const knownSale = salePriceBySize.get(canonicalSize)
        if (knownSale == null) continue
        let idx = html.indexOf(keyword)
        while (idx !== -1) {
          const start = Math.max(0, idx - WINDOW)
          const end = Math.min(html.length, idx + keyword.length + WINDOW)
          const prices = [...html.slice(start, end).matchAll(dollarRe)]
            .map(m => parseFloat((m[1] ?? '0').replace(/,/g, '')))
            .filter(p => p > 200)
          if (prices.length >= 2) {
            const hi = Math.max(...prices)
            const lo = Math.min(...prices)
            const ratio = hi / lo
            // lo should match the known API sale price within $30; hi is MSRP (5-80% higher)
            if (ratio >= 1.05 && ratio <= 1.80 && Math.abs(lo - knownSale) < 30) {
              console.log(`[scrape:nectar] HTML "${canonicalSize}": sale=$${lo} regular=$${hi} (ratio=${ratio.toFixed(2)})`)
              msrpBySize.set(canonicalSize, hi)
              break
            }
          }
          idx = html.indexOf(keyword, idx + 1)
        }
      }

      // --- Consolidate: prefer per-size MSRPs, else derive a uniform ratio ---
      if (msrpBySize.size > 0) {
        const updated = results.map(r => ({ ...r, compare_at_price: msrpBySize.get(r.title) ?? null }))
        const found = updated.filter(r => r.compare_at_price != null).length
        console.log(`[scrape:nectar] ✓ HTML per-size MSRP for ${found}/${results.length} sizes`)
        return updated
      }

      const allCandidates = [...strikeAmounts, ...wasAmounts, ...scriptMsrpCandidates]
      if (allCandidates.length > 0) {
        const salePrices = [...salePriceBySize.values()]
        let bestRatio: number | null = null
        outer: for (const msrp of allCandidates) {
          for (const sale of salePrices) {
            const ratio = msrp / sale
            if (ratio >= 1.05 && ratio <= 1.80) {
              bestRatio = ratio
              console.log(`[scrape:nectar] MSRP $${msrp} vs sale $${sale} → ratio=${ratio.toFixed(2)}`)
              break outer
            }
          }
        }
        if (bestRatio != null) {
          const r = bestRatio
          const updated = results.map(v => ({
            ...v,
            compare_at_price: Math.round(v.price * r * 100) / 100,
          }))
          console.log(`[scrape:nectar] ✓ Applied MSRP ratio ${r.toFixed(2)} to ${results.length} sizes`)
          return updated
        }
      }

      console.log(`[scrape:nectar] No MSRP found in HTML — returning sale prices only`)
    } catch (htmlErr) {
      console.log(`[scrape:nectar] HTML scrape failed:`, htmlErr instanceof Error ? htmlErr.message : htmlErr)
    }
  }

  console.log(`[scrape:nectar] ✓ done, ${results.length} size(s)`)
  return results
}

// ============================================================================
// Helix JSON-endpoint fallback (bypasses DataDome — Helix's browser-rendered
// pages are DataDome-protected and unreachable even through Bright Data's
// Scraping Browser, confirmed via live testing, but the Shopify product.json
// API endpoints aren't behind that same challenge since they're not a page
// load DataDome fingerprints).
// ============================================================================

// Fetch a ScraperAPI URL with a configurable abort timeout — used as a fallback
// when a direct fetch to Helix's JSON endpoints gets blocked.
async function scraperFetch(scraperUrl: string, label: string, timeoutMs: number): Promise<{ ok: boolean; status: number; body: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(scraperUrl, { signal: controller.signal })
    const body = await r.text()
    return { ok: r.ok, status: r.status, body }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.log(`[scrape:helix] ${label} timed out after ${timeoutMs / 1000}s`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

async function tryHelixJsonEndpoints(url: string): Promise<ScrapedVariant[] | null> {
  // --- Approach 0: Shopify product.json endpoint ---
  const helixOrigin = new URL(url).origin
  const handleMatch = url.match(/\/products\/([^\/?#]+)/)
  if (!handleMatch) return null

    const rawHandle = handleMatch[1]
    // Only retry with "helix-" prefix on helixsleep.com — other brands don't use it
    const handlesToTry = helixOrigin.includes('helixsleep.com')
      ? [rawHandle, `helix-${rawHandle}`]
      : [rawHandle]

    // Elite/Luxe products share a single Shopify product URL with all tier variants
    // bundled. option3 distinguishes: "standard support" = base, "ergoalign layer" = Elite/Luxe.
    const isEliteTierUrl = /elite|luxe/i.test(url)

    const parseHelixJson = (data: unknown): ScrapedVariant[] => {
      const product = (data as Record<string, unknown>)?.product as Record<string, unknown> | undefined
      const allVariants = (product?.variants ?? []) as Array<{ option1: string; option2: string; option3: string; price: string; compare_at_price: string | null }>

      // Detect multiple support tiers in one product (Elite + Standard bundled)
      const hasStandardTier = allVariants.some(v => String(v.option3 ?? '').toLowerCase().includes('standard'))
      const hasErgoalignTier = allVariants.some(v => String(v.option3 ?? '').toLowerCase().includes('ergoalign'))
      const hasMultipleTiers = hasStandardTier && hasErgoalignTier
      console.log(`[scrape:helix] Approach 0: isEliteTierUrl=${isEliteTierUrl} hasMultipleTiers=${hasMultipleTiers} (standard=${hasStandardTier} ergoalign=${hasErgoalignTier})`)

      const filteredVariants = hasMultipleTiers
        ? allVariants.filter(v => {
            const o3 = String(v.option3 ?? '').toLowerCase()
            return isEliteTierUrl ? o3.includes('ergoalign') : o3.includes('standard')
          })
        : allVariants
      // Safety: if the tier filter produced nothing (unexpected option3 values),
      // fall back to all variants so we don't silently drop to Approach 2.
      const variants = filteredVariants.length > 0 ? filteredVariants : allVariants

      const extractResults = (pool: typeof allVariants): ScrapedVariant[] => {
        const results: ScrapedVariant[] = []
        for (const v of pool) {
          const size = normalizeSize(String(v.option1 ?? ''))
          if (!size) continue
          if (String(v.option1 ?? '').includes(' with ') && results.some(r => r.title === size)) continue
          const salePrice = v.price != null ? parseFloat(v.price) : null
          const regularPrice = v.compare_at_price != null ? parseFloat(v.compare_at_price) : null
          if (!salePrice || isNaN(salePrice)) continue
          const hasRealSale = regularPrice != null && !isNaN(regularPrice) && regularPrice > salePrice
          results.push({
            title: size,
            price: salePrice,
            compare_at_price: hasRealSale ? regularPrice! : null,
          })
        }
        return results
      }

      return extractResults(variants)
    }

    for (const handle of handlesToTry) {
      const jsonUrl = `${helixOrigin}/products/${handle}.json`
      console.log(`[scrape:helix] Approach 0: ${jsonUrl}`)
      try {
        let jsonText: string | null = null

        // Direct fetch first (works locally; Cloudflare blocks it on CI/serverless IPs)
        const directRes = await fetch(jsonUrl, {
          headers: { ...BROWSER_HEADERS, Referer: helixOrigin + '/' },
        })
        console.log(`[scrape:helix] Approach 0 direct status: ${directRes.status}`)
        if (directRes.ok) {
          jsonText = await directRes.text()
        } else if (process.env.SCRAPER_API_KEY) {
          // Cloudflare blocked the direct request — proxy through ScraperAPI
          console.log(`[scrape:helix] Approach 0: direct blocked (${directRes.status}) — trying ScraperAPI`)
          const scraperUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(jsonUrl)}&render=false&premium=true`
          const { ok, status: s, body } = await scraperFetch(scraperUrl, `Approach 0 ScraperAPI ${handle}`, 15_000)
          console.log(`[scrape:helix] Approach 0 ScraperAPI status: ${s}`)
          if (ok && body.startsWith('{')) jsonText = body
        }

        if (!jsonText) continue
        const results = parseHelixJson(JSON.parse(jsonText))
        if (results.length >= 2) {
          console.log(`[scrape:helix] ✓ Approach 0 (handle="${handle}"): ${results.length} sizes extracted`)
          return results
        }
        console.log(`[scrape:helix] Approach 0 (handle="${handle}") yielded ${results.length} size(s) — trying next handle`)
      } catch (err) {
        console.log(`[scrape:helix] Approach 0 (handle="${handle}") failed:`, err instanceof Error ? err.message : err)
      }
    }
    console.log(`[scrape:helix] Approach 0 exhausted — trying Approach 0.5`)

    // --- Approach 0.5: Shopify catalog endpoint (products.json) ---
    // Some handles 404 on the individual product.json endpoint but are still listed
    // in the paginated catalog. Tries the root catalog first via direct fetch, then
    // the "all" collection catalog via ScraperAPI — collections/all returns a 200
    // Cloudflare challenge page (not real JSON) on a direct fetch.
    const catalogAttempts: Array<{ url: string; viaScraperApi: boolean }> = [
      { url: `${helixOrigin}/products.json?limit=250`, viaScraperApi: false },
      { url: `${helixOrigin}/collections/all/products.json?limit=250`, viaScraperApi: true },
    ]
    for (const { url: catalogUrl, viaScraperApi } of catalogAttempts) {
      if (viaScraperApi && !process.env.SCRAPER_API_KEY) continue
      console.log(`[scrape:helix] Approach 0.5${viaScraperApi ? ' (via ScraperAPI)' : ''}: ${catalogUrl}`)
      try {
        let status: number
        let body: string
        if (viaScraperApi) {
          const scraperUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(catalogUrl)}&render=false&premium=true`
          ;({ status, body } = await scraperFetch(scraperUrl, 'Approach 0.5 collections/all', 10_000))
        } else {
          const catalogRes = await fetch(catalogUrl, {
            headers: { ...BROWSER_HEADERS, Referer: helixOrigin + '/' },
          })
          status = catalogRes.status
          body = await catalogRes.text()
        }
        console.log(`[scrape:helix] Approach 0.5 status: ${status}`)
        if (status < 200 || status >= 300) continue
        const catalogData = JSON.parse(body) as Record<string, unknown>
        const products = Array.isArray(catalogData.products) ? catalogData.products as Array<Record<string, unknown>> : []
        const matched = products.find(p => handlesToTry.includes(String(p.handle ?? '')))
        if (matched) {
          const results = parseHelixJson({ product: matched })
          if (results.length >= 2) {
            console.log(`[scrape:helix] ✓ Approach 0.5 (handle="${matched.handle}"): ${results.length} sizes extracted`)
            return results
          }
          console.log(`[scrape:helix] Approach 0.5 matched handle="${matched.handle}" but yielded ${results.length} size(s)`)
        } else {
          console.log(`[scrape:helix] Approach 0.5: no product in catalog matched handle(s) ${handlesToTry.join(', ')}`)
        }
      } catch (err) {
        console.log(`[scrape:helix] Approach 0.5 (${catalogUrl}) failed:`, err instanceof Error ? err.message : err)
      }
    }
    console.log(`[scrape:helix] Approach 0.5 exhausted — falling through to HTML approaches`)
  return null
}

// ============================================================================
// Universal Bright Data browser scraper
//
// Most brands apply their sale price via client-side JS after page load, so
// parsing static HTML/JSON only ever recovers the base price. This connects a
// real remote Chromium (Bright Data's Scraping Browser handles anti-bot/proxy)
// to every product page, clicks/selects through each size option, and reads
// whatever price is actually rendered in the DOM at that moment.
//
// It has no brand-specific selectors — it heuristically finds a size <select>
// or a group of size-labeled buttons/radios, and reads the price via common
// price/strikethrough markup patterns. This is inherently less precise than
// parsing a stable JSON API, but it's the only way to see post-JS sale prices.
// ============================================================================

const BRIGHT_DATA_WS = process.env.BRIGHT_DATA_WS

async function connectBrightData(): Promise<Browser> {
  if (!BRIGHT_DATA_WS) throw new Error('BRIGHT_DATA_WS not set')
  return chromium.connectOverCDP(BRIGHT_DATA_WS)
}

const FINANCING_RE = /\/\s*mo\b|per\s*month|\bmonth(?:ly)?\b|afterpay|affirm|klarna|financing|as low as/i

async function readDisplayedPrices(page: Page): Promise<{ price: number | null; compareAt: number | null; candidates: number[] }> {
  return page.evaluate((financingPattern: string) => {
    const financingRe = new RegExp(financingPattern, 'i')

    function parsePrice(text: string): number | null {
      const m = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/)
      if (!m || !m[1]) return null
      const n = parseFloat(m[1].replace(/,/g, ''))
      return isNaN(n) || n < 100 ? null : n
    }
    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    // --- Compare-at / MSRP: strikethrough markup or computed line-through style ---
    let compareAt: number | null = null
    const strikeEls = Array.from(
      document.querySelectorAll(
        's, del, [class*="compare" i], [class*="was-price" i], [class*="strikethrough" i], [class*="original-price" i], [class*="msrp" i]'
      )
    )
    for (const el of strikeEls) {
      if (!isVisible(el)) continue
      const text = el.textContent ?? ''
      if (financingRe.test(text)) continue
      const val = parsePrice(text)
      if (val != null) { compareAt = val; break }
    }
    if (compareAt == null) {
      const leafEls = Array.from(document.querySelectorAll('body *')).filter(el => el.children.length === 0)
      for (const el of leafEls) {
        if (!isVisible(el)) continue
        const style = window.getComputedStyle(el)
        if (!style.textDecorationLine.includes('line-through')) continue
        const text = el.textContent ?? ''
        if (financingRe.test(text)) continue
        const val = parsePrice(text)
        if (val != null) { compareAt = val; break }
      }
    }

    // --- Current/sale price: elements whose class/attrs look price-related ---
    const priceEls = Array.from(document.querySelectorAll('[class*="price" i], [data-price], [itemprop="price"]'))
      .filter(el => el.children.length <= 2 && isVisible(el))
    const candidates: number[] = []
    for (const el of priceEls) {
      const style = window.getComputedStyle(el)
      if (style.textDecorationLine.includes('line-through')) continue
      const text = el.textContent ?? ''
      if (financingRe.test(text)) continue
      const val = parsePrice(text)
      if (val != null) candidates.push(val)
    }
    // The sale/current price is the lowest of the visible non-strikethrough price
    // texts (regular price and sale price both often render somewhere on the page).
    // Financing widgets ("$X/mo") often live in a class="...price..." element whose
    // OWN text doesn't contain "month" (it's in a sibling label instead), so they
    // slip past the financingRe check above and would otherwise win Math.min() by
    // being far smaller than the real price. Mattress sales are rarely deeper than
    // ~50% off, so drop candidates under half the largest one before taking the min.
    const maxCandidate = candidates.length > 0 ? Math.max(...candidates) : null
    const plausible = maxCandidate != null ? candidates.filter(c => c >= maxCandidate * 0.5) : candidates
    const price = plausible.length > 0 ? Math.min(...plausible) : null
    return { price, compareAt, candidates }
  }, FINANCING_RE.source)
}

type SizeSelector =
  | { kind: 'select'; select: Locator }
  | { kind: 'clickable'; items: Array<{ locator: Locator; size: string }> }
  | { kind: 'combobox'; sizes: string[] }

// The combobox trigger button's own DOM node can be replaced/re-indexed when the
// page re-renders (e.g. a modal opening/closing shifts index-based locators), so
// it's re-found fresh by this same heuristic every time rather than cached.
async function findComboboxTrigger(page: Page): Promise<Locator | null> {
  const triggers = page.locator('button, [role="button"], [role="combobox"]')
  const count = await triggers.count()
  for (let i = 0; i < count; i++) {
    const el = triggers.nth(i)
    let text = ''
    try {
      text = ((await el.textContent({ timeout: 1000 })) ?? '').trim()
    } catch {
      continue
    }
    if (text && text.length <= 30 && normalizeSize(text) != null) return el
  }
  return null
}

async function findSizeSelector(page: Page): Promise<SizeSelector | null> {
  const selects = page.locator('select')
  const selectCount = await selects.count()
  for (let i = 0; i < selectCount; i++) {
    const sel = selects.nth(i)
    const optionTexts = await sel.locator('option').allTextContents()
    const matched = optionTexts.filter(t => normalizeSize(t) != null)
    if (matched.length >= 2) return { kind: 'select', select: sel }
  }

  const clickables = page.locator('button, [role="radio"], label, input[type="radio"]')
  const count = await clickables.count()
  const seen = new Set<string>()
  const items: Array<{ locator: Locator; size: string }> = []
  for (let i = 0; i < count; i++) {
    const el = clickables.nth(i)
    let text = ''
    try {
      text = ((await el.textContent({ timeout: 2000 })) ?? '').trim()
    } catch {
      continue
    }
    if (!text || text.length > 24) continue
    const size = normalizeSize(text)
    if (!size || seen.has(size)) continue
    seen.add(size)
    items.push({ locator: el, size })
  }
  // Casper/Puffy stash their size labels inside a closed popover (display:none) —
  // the text is findable but clicking would fail on every option, so require
  // visibility here and fall through to the combobox path instead of returning.
  const visibleItems: Array<{ locator: Locator; size: string }> = []
  for (const item of items) {
    try {
      if (await item.locator.isVisible({ timeout: 500 })) visibleItems.push(item)
    } catch {
      // treat as not visible
    }
  }
  if (visibleItems.length >= 2) return { kind: 'clickable', items: visibleItems }

  // Closed combobox pattern: a trigger button whose own text is a label plus the
  // currently-selected size (e.g. "SizeQueen"), which reveals a list of options
  // only after being clicked — nothing is visible/matchable until then.
  const trigger = await findComboboxTrigger(page)
  if (trigger) {
    const triggerText = (await trigger.textContent().catch(() => null)) ?? ''
    console.log(`[scrape:universal] Found closed size-dropdown trigger: "${triggerText.trim()}" — opening it`)
    try {
      await trigger.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(300)
      try {
        await trigger.click({ timeout: 5000 })
      } catch {
        await trigger.click({ timeout: 5000, force: true })
      }
      await page.waitForTimeout(500)

      const options = page.locator('[role="option"], [role="menuitem"], li, button, [role="radio"]')
      const optionCount = await options.count()
      const seenOpt = new Set<string>()
      const optSizes: string[] = []
      for (let j = 0; j < optionCount; j++) {
        const opt = options.nth(j)
        let optText = ''
        try {
          optText = ((await opt.textContent({ timeout: 1000 })) ?? '').trim()
        } catch {
          continue
        }
        if (!optText || optText.length > 24) continue
        const size = normalizeSize(optText)
        if (!size || seenOpt.has(size)) continue
        seenOpt.add(size)
        optSizes.push(size)
      }
      await page.keyboard.press('Escape').catch(() => {})
      if (optSizes.length >= 2) return { kind: 'combobox', sizes: optSizes }
    } catch (err) {
      console.log(`[scrape:universal] combobox trigger click failed:`, err instanceof Error ? err.message : err)
    }
  }

  return null
}

// If variantFilter is set (e.g. Avocado firmness "medium"/"firm"/"plush"), find a
// selector other than the size one whose options/labels match it and pin it —
// mirrors what the old scrapeGeneric did with option2/variant_filter matching.
async function pinVariantFilter(page: Page, variantFilter: string, sizeSelector: SizeSelector): Promise<void> {
  const filterLower = variantFilter.toLowerCase()

  const selects = page.locator('select')
  const selectCount = await selects.count()
  for (let i = 0; i < selectCount; i++) {
    const sel = selects.nth(i)
    if (sizeSelector.kind === 'select') {
      const sizeHandle = await sizeSelector.select.elementHandle()
      const same = sizeHandle ? await sel.evaluate((el, other) => el === other, sizeHandle).catch(() => false) : false
      if (same) continue
    }
    const options = await sel.locator('option').all()
    for (const opt of options) {
      const text = ((await opt.textContent()) ?? '').toLowerCase()
      if (text.includes(filterLower)) {
        const value = await opt.getAttribute('value')
        if (value != null) {
          console.log(`[scrape:universal] Pinning variant_filter="${variantFilter}" via <select> option "${text.trim()}"`)
          await sel.selectOption(value)
          await page.waitForTimeout(500)
        }
        return
      }
    }
  }

  const clickables = page.locator('button, [role="radio"], label')
  const count = await clickables.count()
  for (let i = 0; i < count; i++) {
    const el = clickables.nth(i)
    let text = ''
    try {
      text = ((await el.textContent({ timeout: 2000 })) ?? '').toLowerCase()
    } catch {
      continue
    }
    if (text.includes(filterLower) && normalizeSize(text) == null) {
      console.log(`[scrape:universal] Pinning variant_filter="${variantFilter}" via clickable "${text.trim()}"`)
      await el.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(500)
      return
    }
  }

  console.log(`[scrape:universal] variant_filter="${variantFilter}" — no matching option found, leaving default selection`)
}

// Best-effort dismissal of a promotional/cookie modal that could otherwise
// intercept clicks during size iteration (e.g. TempurPedic shows a promo modal
// after a couple of interactions). Tries each selector in order and stops at
// the first match; silently continues if nothing matches.
async function dismissModal(page: Page): Promise<void> {
  const closeSelectors = [
    'button[aria-label*="close" i]',
    'button[aria-label*="dismiss" i]',
    '.modal__close',
    '.modal-close',
    '[data-close]',
    'button.close',
  ]
  for (const selector of closeSelectors) {
    try {
      const btn = page.locator(selector).first()
      if ((await btn.count()) === 0 || !(await btn.isVisible())) continue
      console.log(`[scrape:universal] Dismissing modal via "${selector}"`)
      await btn.click({ timeout: 3000 })
      await page.waitForTimeout(500)
      return
    } catch {
      // not found/clickable — try next selector
    }
  }
}

async function scrapeUniversal(url: string, variantFilter?: string | null, sharedBrowser?: Browser): Promise<ScrapedVariant[]> {
  const browser = sharedBrowser ?? (await connectBrightData())
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  try {
    console.log(`[scrape:universal] navigating to ${url}`)
    // networkidle is unreliable on real sites — chat widgets, analytics beacons,
    // and personalization polling mean the network often never truly goes idle,
    // so a strict wait for it here would time out even on a healthy page load.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {})
    await page.waitForTimeout(2000)

    await dismissModal(page)

    // Bear's size selector lives in a sticky bottom bar that only mounts after
    // scrolling past the hero section — findSizeSelector() finds nothing until
    // this runs.
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5))
    await page.waitForTimeout(800)

    const sizeSelector = await findSizeSelector(page)
    if (!sizeSelector) {
      throw new Error('Could not find a size selector (select or button/radio group) on the page')
    }
    const sizeList = sizeSelector.kind === 'clickable' ? sizeSelector.items.map(i => i.size)
      : sizeSelector.kind === 'combobox' ? sizeSelector.sizes
      : null
    console.log(`[scrape:universal] size selector: ${sizeSelector.kind}${sizeList ? ` (${sizeList.length} option(s): ${sizeList.join(', ')})` : ''}`)

    if (variantFilter) {
      await pinVariantFilter(page, variantFilter, sizeSelector)
    }

    const results = new Map<string, ScrapedVariant>()

    if (sizeSelector.kind === 'select') {
      // Some sites (e.g. Bear) put the variant <select> in a "sticky" add-to-cart
      // bar that's hidden until scrolled into view — selectOption() would otherwise
      // wait out its full timeout on every single option, one at a time.
      await sizeSelector.select.scrollIntoViewIfNeeded().catch(() => {})
      const options = await sizeSelector.select.locator('option').all()
      for (const opt of options) {
        const text = ((await opt.textContent()) ?? '').trim()
        const size = normalizeSize(text)
        if (!size || results.has(size)) continue
        // getAttribute('value') reads the raw DOM attribute, which <option>
        // elements often omit — the browser falls back to the text content for
        // the actual .value, so read that JS property instead (Naturepedic's
        // options have no value attribute, which was skipping all but the
        // pre-selected one).
        const value = (await opt.evaluate(el => (el as HTMLOptionElement).value)) ?? (await opt.getAttribute('value'))
        if (value == null) continue
        try {
          await sizeSelector.select.selectOption(value, { timeout: 5_000 })
        } catch {
          // Still not interactable (e.g. hidden behind another sticky/lazy
          // element) — force-set the value; bypasses visibility/actionability
          // checks but still fires the site's change handler.
          try {
            await sizeSelector.select.selectOption(value, { timeout: 5_000, force: true })
          } catch (err) {
            console.log(`[scrape:universal] selectOption failed for "${text}":`, err instanceof Error ? err.message : err)
            continue
          }
        }
        await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {})
        await page.waitForTimeout(1200)
        const { price, compareAt, candidates } = await readDisplayedPrices(page)
        console.log(`[scrape:universal] size="${size}" price=${price ?? 'null'} compareAt=${compareAt ?? 'null'} candidates=${JSON.stringify(candidates)}`)
        if (price != null) {
          results.set(size, { title: size, price, compare_at_price: compareAt != null && compareAt > price ? compareAt : null })
        }
      }
    } else if (sizeSelector.kind === 'clickable') {
      for (const { locator, size } of sizeSelector.items) {
        if (results.has(size)) continue
        try {
          await locator.scrollIntoViewIfNeeded().catch(() => {})
          await locator.click({ timeout: 5_000 })
        } catch {
          try {
            await locator.click({ timeout: 5_000, force: true })
          } catch {
            // Some radios (e.g. Avocado) stay outside the viewport even after
            // scrolling — possibly behind a sticky header — so both real and
            // forced Playwright clicks fail their actionability checks. A raw
            // JS .click() bypasses those checks entirely.
            try {
              const handle = await locator.elementHandle()
              if (!handle) throw new Error('no element handle')
              await page.evaluate(el => (el as HTMLElement).click(), handle)
            } catch (err) {
              console.log(`[scrape:universal] click failed for "${size}":`, err instanceof Error ? err.message : err)
              continue
            }
          }
        }
        await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {})
        await page.waitForTimeout(700)
        const { price, compareAt, candidates } = await readDisplayedPrices(page)
        console.log(`[scrape:universal] size="${size}" price=${price ?? 'null'} compareAt=${compareAt ?? 'null'} candidates=${JSON.stringify(candidates)}`)
        if (price != null) {
          results.set(size, { title: size, price, compare_at_price: compareAt != null && compareAt > price ? compareAt : null })
        }
      }
    } else {
      // combobox — the menu closes (and its option elements detach) after each
      // selection, so reopen it fresh and re-find the matching option every time.
      for (const size of sizeSelector.sizes) {
        if (results.has(size)) continue
        try {
          const trigger = await findComboboxTrigger(page)
          if (!trigger) {
            console.log(`[scrape:universal] combobox: trigger not found on reopen for "${size}"`)
            continue
          }
          await trigger.scrollIntoViewIfNeeded().catch(() => {})
          await trigger.click({ timeout: 5000 }).catch(() => trigger.click({ timeout: 5000, force: true }))
          await page.waitForTimeout(400)

          const options = page.locator('[role="option"], [role="menuitem"], li, button, [role="radio"]')
          const optionCount = await options.count()
          let matched: Locator | null = null
          for (let j = 0; j < optionCount; j++) {
            const opt = options.nth(j)
            const optText = ((await opt.textContent({ timeout: 1000 }).catch(() => null)) ?? '').trim()
            if (normalizeSize(optText) === size) { matched = opt; break }
          }
          if (!matched) {
            console.log(`[scrape:universal] combobox: option for "${size}" not found on reopen`)
            await page.keyboard.press('Escape').catch(() => {})
            continue
          }
          await matched.click({ timeout: 5000 }).catch(() => matched!.click({ timeout: 5000, force: true }))
        } catch (err) {
          console.log(`[scrape:universal] combobox click failed for "${size}":`, err instanceof Error ? err.message : err)
          continue
        }
        await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {})
        await page.waitForTimeout(700)
        const { price, compareAt, candidates } = await readDisplayedPrices(page)
        console.log(`[scrape:universal] size="${size}" price=${price ?? 'null'} compareAt=${compareAt ?? 'null'} candidates=${JSON.stringify(candidates)}`)
        if (price != null) {
          results.set(size, { title: size, price, compare_at_price: compareAt != null && compareAt > price ? compareAt : null })
        }
      }
    }

    if (results.size === 0) {
      throw new Error('Size selector found but no prices could be read for any option')
    }

    console.log(`[scrape:universal] ✓ ${results.size} size(s) extracted`)
    return [...results.values()]
  } finally {
    await context.close()
    if (!sharedBrowser) await browser.close()
  }
}

export async function scrapeForBrand(brand: string, url: string, variantFilter?: string | null, productName?: string, apiProductName?: string, browser?: Browser): Promise<ScrapedVariant[]> {
  const normalizedBrand = brand.toLowerCase()
  if (normalizedBrand === 'nectar') return scrapeNectar(url, variantFilter, 'nectar', apiProductName)
  if (normalizedBrand === 'dreamcloud') return scrapeNectar(url, variantFilter, 'dreamcloud', apiProductName)
  if (normalizedBrand === 'helix') {
    // Helix's rendered pages are DataDome-protected and unreachable even through
    // Bright Data's Scraping Browser (confirmed live), so don't fall through to
    // scrapeUniversal — it would just burn a session on a guaranteed block.
    const jsonResult = await tryHelixJsonEndpoints(url)
    if (jsonResult) return jsonResult
    throw new Error('Helix JSON endpoints exhausted — no product.json/products.json match found, and browser scraping is blocked by DataDome')
  }

  const SHOPIFY_HOSTS = new Set([
    'casper.com', 'birchliving.com', 'winkbeds.com', 'puffy.com', 'bearmattress.com',
  ])
  const host = new URL(url).hostname.replace(/^www\./, '')
  if (SHOPIFY_HOSTS.has(host)) {
    const shopifyResult = await tryShopifyProductJson(url)
    if (shopifyResult) return shopifyResult
    console.log(`[scrape:shopify] JSON failed — falling through to browser scraping`)
  }

  return scrapeUniversal(url, variantFilter, browser)
}
