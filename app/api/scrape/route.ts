import { load } from 'cheerio'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATALOG } from '@/lib/catalog'

export type ScrapedVariant = {
  title: string
  price: number           // current/sale price (what consumers pay)
  compare_at_price: number | null  // MSRP/list price (strikethrough), or null if no sale
}

function normalizeSize(title: string): string | null {
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

// Shopify embeds prices as integers in cents. Mattresses are $500–$5000,
// so raw values > 10000 are almost certainly cents (e.g. 159900 → $1599).
// Values with a decimal point are already dollars.
function parsePriceField(raw: unknown): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  const n = parseFloat(s)
  if (isNaN(n)) return null
  if (!s.includes('.') && n > 10000) return n / 100
  return n
}

function tryParseVariants(json: unknown): ScrapedVariant[] | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>

  // Direct product object: { variants: [...] }
  const variantsArray = Array.isArray(obj.variants)
    ? obj.variants
    : Array.isArray((obj.product as Record<string, unknown> | undefined)?.variants)
    ? (obj.product as Record<string, unknown>).variants as unknown[]
    : null

  if (!variantsArray || variantsArray.length === 0) return null

  const results: ScrapedVariant[] = []
  for (const v of variantsArray) {
    const variant = v as Record<string, unknown>
    const title = String(variant.title ?? variant.name ?? '')
    const price = parsePriceField(variant.price)
    const compareAt = parsePriceField(variant.compare_at_price ?? variant.compareAtPrice ?? null)
    if (price !== null && title) {
      results.push({ title, price, compare_at_price: compareAt })
    }
  }
  return results.length > 0 ? results : null
}

async function scrapeHelix(url: string): Promise<ScrapedVariant[]> {
  // --- Approach 0: Shopify product.json endpoint ---
  const helixOrigin = new URL(url).origin
  const handleMatch = url.match(/\/products\/([^/?#]+)/)
  if (handleMatch) {
    const rawHandle = handleMatch[1]
    // Only retry with "helix-" prefix on helixsleep.com — other brands don't use it
    const handlesToTry = helixOrigin.includes('helixsleep.com')
      ? [rawHandle, `helix-${rawHandle}`]
      : [rawHandle]

    const parseHelixJson = (data: unknown): ScrapedVariant[] => {
      const product = (data as Record<string, unknown>)?.product as Record<string, unknown> | undefined
      const variants = (product?.variants ?? []) as Array<{ option1: string; price: string; compare_at_price: string | null }>
      const results: ScrapedVariant[] = []
      for (const v of variants) {
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

    for (const handle of handlesToTry) {
      const jsonUrl = `${helixOrigin}/products/${handle}.json`
      console.log(`[scrape:helix] Approach 0: ${jsonUrl}`)
      try {
        const jsonRes = await fetch(jsonUrl, {
          headers: { ...BROWSER_HEADERS, Referer: helixOrigin + '/' },
        })
        console.log(`[scrape:helix] Approach 0 status: ${jsonRes.status}`)
        if (!jsonRes.ok) continue
        const results = parseHelixJson(await jsonRes.json())
        if (results.length >= 2) {
          console.log(`[scrape:helix] ✓ Approach 0 (handle="${handle}"): ${results.length} sizes extracted`)
          return results
        }
        console.log(`[scrape:helix] Approach 0 (handle="${handle}") yielded ${results.length} size(s) — trying next handle`)
      } catch (err) {
        console.log(`[scrape:helix] Approach 0 (handle="${handle}") failed:`, err instanceof Error ? err.message : err)
      }
    }
    console.log(`[scrape:helix] Approach 0 exhausted — falling through to HTML approaches`)
  }

  // HTML fetch needed for Approaches 1 and 3.
  // Use ScraperAPI to avoid 403s from Cloudflare on Vercel's IP ranges.
  const targetUrl = url
  console.log(`[scrape:helix] Fetching HTML: ${targetUrl}`)
  let res: Response
  // Helper: fetch a ScraperAPI URL with a 25s abort timeout
  async function scraperFetch(scraperUrl: string, label: string): Promise<{ ok: boolean; status: number; body: string }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)
    try {
      const r = await fetch(scraperUrl, { signal: controller.signal })
      const body = await r.text()
      return { ok: r.ok, status: r.status, body }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log(`[scrape:helix] ${label} timed out after 25s`)
      }
      throw e
    } finally {
      clearTimeout(timeout)
    }
  }

  let htmlBody: string | null = null

  if (process.env.SCRAPER_API_KEY) {
    console.log(`[scrape:helix] ScraperAPI target URL: ${targetUrl}`)

    // Attempt 1: ultra_premium
    try {
      const ultraUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true&ultra_premium=true`
      console.log(`[scrape:helix] ScraperAPI proxy URL (key redacted): http://api.scraperapi.com?api_key=REDACTED&url=${encodeURIComponent(targetUrl)}&render=true&ultra_premium=true`)
      const { ok, status, body } = await scraperFetch(ultraUrl, 'ultra_premium')
      console.log(`[scrape:helix] ScraperAPI ultra_premium status: ${status}, body length: ${body.length}`)
      if (ok && body.length >= 10_000) {
        console.log(`[scrape:helix] ultra_premium succeeded`)
        htmlBody = body
      } else {
        console.log(`[scrape:helix] ultra_premium blocked (status=${status}, len=${body.length}) — retrying with premium`)
      }
    } catch {
      console.log(`[scrape:helix] ultra_premium threw — retrying with premium`)
    }

    // Attempt 2: premium fallback
    if (!htmlBody) {
      try {
        const premiumUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true&premium=true`
        const { ok, status, body } = await scraperFetch(premiumUrl, 'premium')
        console.log(`[scrape:helix] ScraperAPI premium status: ${status}, body length: ${body.length}`)
        if (ok && body.length >= 10_000) {
          console.log(`[scrape:helix] fell back to premium`)
          htmlBody = body
        } else {
          console.log(`[scrape:helix] premium also blocked (status=${status}, len=${body.length})`)
        }
      } catch {
        console.log(`[scrape:helix] premium threw`)
      }
    }
  }

  // Attempt 3: direct fetch (no proxy)
  if (!htmlBody) {
    console.log(`[scrape:helix] attempting direct fetch: ${targetUrl}`)
    try {
      const directRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(10_000),
      })
      console.log(`[scrape:helix] direct fetch status: ${directRes.status}`)
      const body = await directRes.text()
      if (directRes.ok && body.length >= 10_000) {
        console.log(`[scrape:helix] direct fetch succeeded`)
        htmlBody = body
      } else {
        console.log(`[scrape:helix] direct fetch also failed (status=${directRes.status}, len=${body.length})`)
      }
    } catch (e) {
      console.log(`[scrape:helix] direct fetch threw: ${e instanceof Error ? e.message : e}`)
    }
  }

  if (!htmlBody) throw new Error('All ScraperAPI and direct fetch attempts failed for Helix page')

  console.log(`[scrape:helix] ScraperAPI body (first 500 chars): ${htmlBody.slice(0, 500)}`)
  // Re-wrap into a Response so the rest of the function can call res.text() / res.ok normally
  res = new Response(htmlBody, { status: 200 })
  console.log(`[scrape:helix] Status: ${res.status}`)
  if (!res.ok) throw new Error(`HTML fetch failed: ${res.status}`)
  const html = await res.text()
  console.log(`[scrape:helix] HTML size: ${html.length} bytes`)
  const $ = load(html)

  // --- Approach 1: buy-box Livewire component ---
  const wireMatches = [...html.matchAll(/wire:initial-data="([^"]+)"/g)]
  console.log(`[scrape:helix] Found ${wireMatches.length} wire:initial-data attributes`)

  const parseWireVariants = (items: Array<Record<string, unknown>>, source: string): ScrapedVariant[] => {
    const sizeMap = new Map<string, ScrapedVariant>()
    for (const v of items) {
      const sizeRaw = String(v?.option_1 ?? v?.option1 ?? v?.title ?? '')
      const size = normalizeSize(sizeRaw)
      if (!size || sizeMap.has(size)) continue

      const priceRaw = v?.price
      const priceCents = typeof priceRaw === 'number' ? priceRaw : parseInt(String(priceRaw ?? 0), 10)
      const regularPrice = priceCents / 100

      const presentment = v?.presentment_prices as Array<Record<string, unknown>> | undefined
      const compareAtObj = presentment?.[0]?.compare_at_price as Record<string, unknown> | null | undefined
      const presentmentSale = compareAtObj?.amount != null ? parseFloat(String(compareAtObj.amount)) : null

      const directCompareAt = v?.compare_at_price
      const directSale = directCompareAt != null && directCompareAt !== 0 && directCompareAt !== '0'
        ? (typeof directCompareAt === 'number' ? directCompareAt / 100 : parseFloat(String(directCompareAt)))
        : null

      const salePrice = presentmentSale ?? directSale
      console.log(`[scrape:helix] ${source} size="${size}" regular=$${regularPrice} sale=${salePrice != null ? `$${salePrice}` : 'null'}`)
      sizeMap.set(size, { title: size, price: regularPrice, compare_at_price: salePrice })
    }
    return [...sizeMap.values()]
  }

  for (let i = 0; i < wireMatches.length; i++) {
    const rawAttr = wireMatches[i]?.[1] ?? ''
    const decoded = rawAttr
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(decoded)
    } catch {
      console.log(`[scrape:helix] wire:initial-data[${i}] failed to parse as JSON`)
      continue
    }

    const componentName = (parsed?.fingerprint as Record<string, unknown> | undefined)?.name as string ?? ''
    console.log(`[scrape:helix] wire:initial-data[${i}] fingerprint.name="${componentName}"`)

    if (componentName !== 'buy-box') continue

    console.log(`[scrape:helix] Found buy-box at index ${i}`)
    console.log(`[scrape:helix] buy-box top-level keys:`, Object.keys(parsed))

    // 1a: serverMemo.data (Livewire v2) or memo.data (Livewire v3) — contains full variant list
    const serverMemoData = (parsed?.serverMemo as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined
    const memoData = (parsed?.memo as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined
    const componentData = serverMemoData ?? memoData

    if (componentData) {
      console.log(`[scrape:helix] buy-box componentData keys:`, Object.keys(componentData))
      for (const [key, val] of Object.entries(componentData)) {
        console.log(`[scrape:helix] buy-box componentData.${key}:`, JSON.stringify(val)?.slice(0, 300))
      }

      // Find array fields whose elements look like variant objects (have price + option/title)
      for (const [key, val] of Object.entries(componentData)) {
        if (!Array.isArray(val) || val.length < 2) continue
        const sample = val[0] as Record<string, unknown>
        if (!sample || typeof sample !== 'object') continue
        if (sample.price == null && sample.option_1 == null && sample.option1 == null) continue

        console.log(`[scrape:helix] buy-box componentData.${key}: ${val.length} items, sample:`, JSON.stringify(sample)?.slice(0, 300))
        const variants = parseWireVariants(val as Array<Record<string, unknown>>, `buy-box componentData.${key}`)
        if (variants.length > 1) {
          console.log(`[scrape:helix] ✓ Approach 1 (serverMemo.data.${key}): ${variants.length} sizes extracted`)
          return variants
        }
      }
    }

    // 1b: emits[0].params (original path — may only carry the default variant)
    const effects = parsed?.effects as Record<string, unknown> | undefined
    const emits = effects?.emits as Array<Record<string, unknown>> | undefined
    const params = emits?.[0]?.params

    const rawVariants: Array<Record<string, unknown>> =
      Array.isArray(params) && Array.isArray((params as unknown[])?.[0])
        ? (((params as unknown[][])?.[0]) as Array<Record<string, unknown>>) ?? []
        : Array.isArray(params)
        ? (params as Array<Record<string, unknown>>)
        : []

    console.log(`[scrape:helix] buy-box emits[0].params: ${rawVariants.length} variant(s)`)
    if (rawVariants.length > 0) {
      console.log(`[scrape:helix] buy-box sample variant:`, JSON.stringify(rawVariants[0])?.slice(0, 500) ?? '')
    }

    if (rawVariants.length > 1) {
      const variants = parseWireVariants(rawVariants, 'buy-box emit')
      if (variants.length > 1) {
        console.log(`[scrape:helix] ✓ Approach 1 (buy-box emits): ${variants.length} sizes extracted`)
        return variants
      }
    }

    console.log(`[scrape:helix] buy-box yielded no multi-size data — falling through to Approach 3`)
    break
  }

  // --- Approach 2: Embedded variants JSON with discounted_price field ---
  // Helix embeds a full variants array in the page. Each element contains:
  //   option_1_label: "Twin" / "King" / "CA King" etc.
  //   price_formatted: "$1,732"  ← MSRP/regular price
  //   discounted_price: 129900   ← sale price in cents
  // Filter to option_2 containing "tencel" to get one row per size.
  console.log(`[scrape:helix] Approach 2: embedded discounted_price variants scan`)
  {
    const discountedIdx = html.indexOf('"discounted_price":')
    if (discountedIdx !== -1) {
      // Walk backward to find the '[' that opens the enclosing array.
      let depth = 0
      let arrayStart = -1
      for (let i = discountedIdx; i >= 0; i--) {
        const ch = html[i]
        if (ch === '}' || ch === ']') {
          depth++
        } else if (ch === '{' || ch === '[') {
          if (depth > 0) {
            depth--
          } else if (ch === '[') {
            arrayStart = i
            break
          }
          // ch === '{' at depth 0 means we crossed the current element's open brace — keep scanning
        }
      }

      if (arrayStart !== -1) {
        // Walk forward to find the matching ']', tracking string escapes.
        let d2 = 1
        let arrayEnd = -1
        let inStr = false
        let esc = false
        for (let i = arrayStart + 1; i < html.length; i++) {
          const ch = html[i]
          if (esc) { esc = false; continue }
          if (ch === '\\' && inStr) { esc = true; continue }
          if (ch === '"') { inStr = !inStr; continue }
          if (inStr) continue
          if (ch === '[' || ch === '{') d2++
          else if (ch === ']' || ch === '}') {
            if (--d2 === 0) { arrayEnd = i; break }
          }
        }

        if (arrayEnd !== -1) {
          try {
            const arr = JSON.parse(html.slice(arrayStart, arrayEnd + 1)) as Array<Record<string, unknown>>
            const helixSizeMap = new Map<string, ScrapedVariant>()

            for (const v of arr) {
              // Use TENCEL cover as the base option (one row per size).
              const option2 = String(v.option_2 ?? '').toLowerCase()
              if (!option2.includes('tencel')) continue

              const label = String(v.option_1_label ?? v.option_1 ?? '')
              const size = normalizeSize(label)
              if (!size || helixSizeMap.has(size)) continue

              const salePrice = typeof v.discounted_price === 'number' ? v.discounted_price / 100 : null
              if (!salePrice) continue

              const priceStr = String(v.price_formatted ?? '').replace(/[$,]/g, '')
              const regularPrice = parseFloat(priceStr)

              helixSizeMap.set(size, {
                title: size,
                price: salePrice,
                compare_at_price: !isNaN(regularPrice) && regularPrice > salePrice ? regularPrice : null,
              })
            }

            if (helixSizeMap.size >= 2) {
              const variants = [...helixSizeMap.values()]
              console.log(`[scrape:helix] ✓ Approach 2 (embedded variants JSON): ${variants.length} sizes extracted`)
              return variants
            }
            console.log(`[scrape:helix] Approach 2: only ${helixSizeMap.size} size(s) — falling through to Approach 3`)
          } catch (parseErr) {
            console.log(`[scrape:helix] Approach 2: JSON parse failed:`, parseErr instanceof Error ? parseErr.message : parseErr)
          }
        } else {
          console.log(`[scrape:helix] Approach 2: could not find closing ']'`)
        }
      } else {
        console.log(`[scrape:helix] Approach 2: could not find opening '[' for variants array`)
      }
    } else {
      console.log(`[scrape:helix] Approach 2: "discounted_price" not found in HTML`)
    }
  }

  // --- Approach 3: dollar amounts near size keywords ---
  // Prices appear as sequential (regular, sale) pairs in the HTML: index 0+1, 2+3, etc.
  // More specific names first to prevent substring false-positives.
  console.log(`[scrape:helix] Approach 3: dollar-amount scan`)

  const SIZE_KEYWORDS: Array<[string, string]> = [
    ['Twin XL', 'Twin XL'],
    ['California King', 'Cal King'],
    ['Cal King', 'Cal King'],
    ['Twin', 'Twin'],
    ['Full', 'Full'],
    ['Queen', 'Queen'],
    ['King', 'King'],
  ]

  const WINDOW = 600
  const sizeMap3 = new Map<string, ScrapedVariant>()

  // Diagnostic: log all case-insensitive "king" positions so we can see why the
  // rendered King pricing section (expected ~pos 392000+) may not be found.
  {
    const lc = html.toLowerCase()
    const kingPositions: number[] = []
    let ki = lc.indexOf('king')
    while (ki !== -1) { kingPositions.push(ki); ki = lc.indexOf('king', ki + 1) }
    console.log(`[scrape:helix] Approach 3: "king" (case-insensitive) at ${kingPositions.length} positions (first 20):`, kingPositions.slice(0, 20))
    for (const pos of kingPositions.filter(p => p >= 380000)) {
      const ctx = html.slice(Math.max(0, pos - 60), Math.min(html.length, pos + 120))
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      console.log(`[scrape:helix] Approach 3: king @${pos}: "${ctx}"`)
    }
  }

  for (const [keyword, canonicalSize] of SIZE_KEYWORDS) {
    if (sizeMap3.has(canonicalSize)) continue

    let idx = html.indexOf(keyword)
    if (idx === -1) {
      console.log(`[scrape:helix] Approach 3: "${keyword}" not found in HTML`)
      continue
    }

    // Scan each occurrence with a narrow ±WINDOW window. Skip occurrences with no valid
    // price pair — bad hits (JSON blobs, nav links, wrong-size context) are naturally
    // discarded because their price sequences don't form a valid (regular, sale) pair.
    while (idx !== -1) {
      const start = Math.max(0, idx - WINDOW)
      const end = Math.min(html.length, idx + keyword.length + WINDOW)
      const snippet = html.slice(start, end)

      const rawPrices = [...snippet.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)]
        .map(m => parseFloat((m[1] ?? '0').replace(/,/g, '')))
        .filter(p => p > 200)

      console.log(`[scrape:helix] Approach 3: near "${keyword}" (pos ${idx}) prices:`, rawPrices)

      if (rawPrices.length >= 2) {
        // Prices appear as sequential (regular, sale) pairs.
        // Collect all valid step-2 pairs, pick the one with smallest sale price.
        const validPairs: Array<{ regular: number; sale: number }> = []
        for (let i = 0; i + 1 < rawPrices.length; i += 2) {
          const regular = rawPrices[i]!
          const sale = rawPrices[i + 1]!
          const ratio = regular / sale
          if (ratio >= 1.10 && ratio <= 1.50) {
            validPairs.push({ regular, sale })
          }
        }

        if (validPairs.length > 0) {
          const best = validPairs.sort((a, b) => a.sale - b.sale)[0]!
          console.log(`[scrape:helix] Approach 3: "${canonicalSize}" regular=$${best.regular} sale=$${best.sale}`)
          sizeMap3.set(canonicalSize, { title: canonicalSize, price: best.sale, compare_at_price: best.regular })
          break
        }
        // No valid pair at this occurrence — try the next
      }

      idx = html.indexOf(keyword, idx + 1)
    }

    if (!sizeMap3.has(canonicalSize)) {
      console.log(`[scrape:helix] Approach 3: "${canonicalSize}" — no valid price pair found, skipping`)
    }
  }

  if (sizeMap3.size > 0) {
    const variants = [...sizeMap3.values()]
    console.log(`[scrape:helix] ✓ Approach 3: ${variants.length} sizes extracted`)
    return variants
  }

  // --- Fallback: og:price:amount (single price, no size breakdown) ---
  const ogPrice = $('meta[property="og:price:amount"]').attr('content')
  const ogTitle = $('meta[property="og:title"]').attr('content') ?? 'Unknown'
  if (ogPrice) {
    const price = parseFloat(ogPrice)
    if (!isNaN(price)) {
      console.log(`[scrape:helix] ✓ og fallback: og:price:amount = ${price} for "${ogTitle}"`)
      return [{ title: ogTitle, price, compare_at_price: null }]
    }
  }

  console.log(`[scrape:helix] All approaches exhausted — no price data found`)
  throw new Error('Could not extract variant prices from Helix page')
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
}

async function scrapeGeneric(url: string, variantFilter?: string | null): Promise<ScrapedVariant[]> {
  // --- Attempt 1: Shopify product JSON endpoint ---
  // Strip query params so /?variant=123 doesn't end up in the .json URL.
  const urlObj = new URL(url)
  const jsonUrl = `https://${urlObj.host}${urlObj.pathname.replace(/\/$/, '')}.json`
  console.log(`[scrape:generic] Trying Shopify JSON: ${jsonUrl}`)

  try {
    const jsonRes = await fetch(jsonUrl, { headers: BROWSER_HEADERS })
    console.log(`[scrape:generic] JSON response: ${jsonRes.status}`)

    if (jsonRes.ok) {
      const data = await jsonRes.json() as Record<string, unknown>
      const product = data?.product as Record<string, unknown> | undefined
      const variants = product?.variants as Array<Record<string, unknown>> | undefined

      if (Array.isArray(variants) && variants.length > 0) {
        console.log(`[scrape:generic] Total variants in JSON: ${variants.length}`)
        console.log('[scrape:generic] First 5 variant IDs in JSON:', variants.slice(0, 5).map(v => `${v.id} (${v.option1}/${v.option2}/${v.option3})`))
        const uniqueOpt1 = [...new Set(variants.map(v => String(v.option1 ?? '')))]
        console.log('[scrape:generic] All unique option1 values:', JSON.stringify(uniqueOpt1))

        // If the URL had ?variant=ID, pin the sub-option (feel/firmness/cover) so we
        // consistently price the same option across all sizes.
        // Shopify product.json uses option1/option2/option3 (no underscores).
        const variantParam = urlObj.searchParams.get('variant')
        let pool = variants

        if (variantParam) {
          console.log(`[scrape:generic] Looking for variant ID: ${variantParam}`)
          const pinned = variants.find(v => v.id == variantParam || String(v.id) === String(variantParam))
          if (pinned) {
            console.log(`[scrape:generic] Matched variant: option1="${pinned.option1}" option2="${pinned.option2}" option3="${pinned.option3}"`)
            // Find the option key whose value (a) is not a size and (b) actually narrows the pool.
            // Try option2 first, then option3, then option1. This handles products where the
            // model/feel is in option1 and size is in option2 (e.g. Brooklyn Bedding).
            let narrowed = false
            for (const key of ['option2', 'option3', 'option1'] as const) {
              const val = pinned[key]
              if (val == null) continue
              const s = String(val).trim()
              if (!s || normalizeSize(s)) continue  // skip blank or size values
              const candidate = variants.filter(v => String(v[key] ?? '') === s)
              if (candidate.length > 0 && candidate.length < variants.length) {
                console.log(`[scrape:generic] Pinning by ${key}="${s}" → ${candidate.length}/${variants.length} variants`)
                pool = candidate
                narrowed = true
                break
              }
            }
            if (!narrowed) {
              console.log(`[scrape:generic] No discriminating option found — using all ${variants.length} variants`)
            }
          } else {
            console.log(`[scrape:generic] Variant ID ${variantParam} not found in JSON — using all variants`)
          }
        }

        // When no ?variant=ID pinned a specific model/feel, fall back to the
        // variant_filter field as a case-insensitive option2 substring match.
        // e.g. variant_filter="Plush Pillow-Top" narrows Avocado's 18 variants
        // to just the 6 Plush Pillow-Top sizes before deduplication.
        if (!variantParam && variantFilter) {
          const filterLower = variantFilter.toLowerCase()
          const filtered = pool.filter(v =>
            String(v.option2 ?? '').toLowerCase().includes(filterLower)
          )
          if (filtered.length > 0) {
            console.log(`[scrape:generic] variant_filter="${variantFilter}" narrowed via option2 substring: ${pool.length} → ${filtered.length}`)
            pool = filtered
          } else {
            console.log(`[scrape:generic] variant_filter="${variantFilter}" matched no option2 values — using all ${pool.length} variants`)
          }
        }

        console.log(`[scrape:generic] Pool after option2 filter: ${pool.length} of ${variants.length} variants`)

        // Deduplicate by size (option1), preferring the best representative per size:
        //   1. Variant with compare_at_price set (has real sale pricing)
        //   2. Variant with highest inventory_quantity
        //   3. First variant encountered for that size
        const best = new Map<string, Record<string, unknown>>()
        let hasCompareAt = false

        for (const v of pool) {
          // option1 is the size in most Shopify products; fall back to option2 for brands
          // that put the model in option1 and size in option2 (e.g. Brooklyn Bedding).
          const option1 = String(v.option1 ?? '')
          let size = normalizeSize(option1)
          const sizeSource = size ? option1 : String(v.option2 ?? '')
          if (!size) size = normalizeSize(sizeSource)
          if (!size) continue
          // Skip bundle/add-on variants (e.g. "Twin with Frost Cooling Cover") when a
          // clean size variant already exists, so they don't overwrite the real price.
          if (sizeSource.includes(' with ') && best.has(size)) continue
          const regularPrice = v.compare_at_price != null ? parseFloat(String(v.compare_at_price)) : null
          const validCompareAt = regularPrice != null && !isNaN(regularPrice)
          if (validCompareAt) hasCompareAt = true

          const existing = best.get(size)
          if (!existing) {
            best.set(size, v)
          } else {
            // Prefer variant with compare_at over one without
            const existingHasCompareAt = existing.compare_at_price != null
            if (!existingHasCompareAt && validCompareAt) {
              best.set(size, v)
            } else if (existingHasCompareAt === validCompareAt) {
              // Same compare_at status — prefer higher inventory
              const existingQty = typeof existing.inventory_quantity === 'number' ? existing.inventory_quantity : 0
              const vQty = typeof v.inventory_quantity === 'number' ? v.inventory_quantity : 0
              if (vQty > existingQty) best.set(size, v)
            }
          }
        }

        const seen = new Map<string, ScrapedVariant>()
        for (const [size, v] of best) {
          const salePrice = v.price != null ? parseFloat(String(v.price)) : null
          const regularPrice = v.compare_at_price != null ? parseFloat(String(v.compare_at_price)) : null
          if (salePrice == null || isNaN(salePrice)) continue
          seen.set(size, {
            title: size,
            price: salePrice,
            compare_at_price: regularPrice != null && !isNaN(regularPrice) ? regularPrice : null,
          })
        }

        if (seen.size === 0) {
          console.log(`[scrape:generic] Shopify JSON returned variants but none matched known sizes`)
        } else if (hasCompareAt) {
          // compare_at_price already populated in JSON — use it directly, no HTML needed
          const results = [...seen.values()]
          console.log(`[scrape:generic] ✓ Shopify JSON with built-in compare_at, found ${results.length} variants`)
          return results
        } else {
          // No built-in sale prices — try to find a discount from the page HTML
          console.log(`[scrape:generic] JSON has no compare_at — fetching HTML to look for discount`)
          let discountRatio: number | null = null

          try {
            const htmlRes = await fetch(url, { headers: { ...BROWSER_HEADERS, Referer: new URL(url).origin + '/' } })
            if (htmlRes.ok) {
              const html = await htmlRes.text()
              console.log(`[scrape:generic] HTML size: ${html.length} bytes`)

              // 1. Percentage discount pattern (e.g. "25% off" or "Save 25%")
              const pctMatch = html.match(/(\d+)%\s*off/i) ?? html.match(/save\s+(\d+)%/i)
              if (pctMatch) {
                const pct = parseInt(pctMatch[1], 10)
                console.log(`[scrape:generic] Found ${pct}% discount in HTML`)
                discountRatio = 1 - pct / 100
              }

              // 2. No percentage — try dollar pair near any size keyword to derive ratio
              if (discountRatio === null) {
                const SIZE_KEYWORDS: Array<[string, string]> = [
                  ['Twin XL', 'Twin XL'], ['California King', 'Cal King'], ['Cal King', 'Cal King'],
                  ['Twin', 'Twin'], ['Full', 'Full'], ['Queen', 'Queen'], ['King', 'King'],
                ]
                const dollarRe = /\$\s*([\d,]+(?:\.\d{2})?)/g
                const WINDOW = 600

                for (const [keyword] of SIZE_KEYWORDS) {
                  const idx = html.indexOf(keyword)
                  if (idx === -1) continue
                  const start = Math.max(0, idx - WINDOW)
                  const end = Math.min(html.length, idx + keyword.length + WINDOW)
                  const prices = [...html.slice(start, end).matchAll(dollarRe)]
                    .map(m => parseFloat((m[1] ?? '0').replace(/,/g, '')))
                    .filter(p => p > 200)
                  if (prices.length >= 2) {
                    const hi = Math.max(...prices)
                    const lo = Math.min(...prices)
                    discountRatio = lo / hi
                    console.log(`[scrape:generic] Derived discount ratio ${discountRatio.toFixed(4)} from "${keyword}" pair $${hi}/$${lo}`)
                    break
                  }
                }
              }

              if (discountRatio === null) {
                console.log(`[scrape:generic] No discount found, using regular prices only`)
              }
            }
          } catch (htmlErr) {
            console.log(`[scrape:generic] HTML fetch for discount failed:`, htmlErr instanceof Error ? htmlErr.message : htmlErr)
          }

          // Apply discount ratio to every size from the JSON.
          // v.price = current Shopify list price (no compare_at set); derived sale = list * ratio.
          const results = [...seen.values()].map(v => {
            if (discountRatio == null) return v
            const derivedSale = Math.round(v.price * discountRatio * 100) / 100
            return { ...v, price: derivedSale, compare_at_price: v.price }
          })
          console.log(`[scrape:generic] ✓ Shopify JSON + discount, found ${results.length} variants`)
          return results
        }
      }
    }
  } catch (err) {
    console.log(`[scrape:generic] Shopify JSON fetch error:`, err instanceof Error ? err.message : err)
  }

  // --- Attempt 2: HTML scraping ---
  console.log(`[scrape:generic] Falling back to HTML scrape: ${url}`)
  const htmlRes = await fetch(url, { headers: { ...BROWSER_HEADERS, Referer: urlObj.origin + '/' } })
  console.log(`[scrape:generic] HTML response: ${htmlRes.status}`)
  if (!htmlRes.ok) throw new Error(`HTML fetch failed: ${htmlRes.status}`)

  const html = await htmlRes.text()
  console.log(`[scrape:generic] HTML size: ${html.length} bytes`)

  const $html = load(html)

  // --- 2a: Embedded variant JSON in script tags ---
  // Check window.__INITIAL_STATE__, ShopifyAnalytics, and application/json scripts
  const inlineScripts = $html('script:not([src])').toArray()
  console.log(`[scrape:generic] Scanning ${inlineScripts.length} inline scripts for embedded variant data`)
  let embeddedVariants: ScrapedVariant[] | null = null

  for (const el of inlineScripts) {
    const scriptType = $html(el).attr('type') ?? ''
    const src = $html(el).text().trim()
    if (!src) continue

    // application/json blocks (headless/React storefronts)
    if (scriptType === 'application/json' || scriptType.includes('json')) {
      try {
        const result = tryParseVariants(JSON.parse(src))
        if (result && result.length > 1) {
          console.log(`[scrape:generic] Found ${result.length} variants in application/json script`)
          embeddedVariants = result
          break
        }
      } catch { /* not parseable */ }
    }

    // window.__INITIAL_STATE__ = {...}
    if (src.includes('__INITIAL_STATE__')) {
      const m = src.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;/)
      if (m) {
        try {
          const result = tryParseVariants(JSON.parse(m[1]))
          if (result && result.length > 1) {
            console.log(`[scrape:generic] Found ${result.length} variants in window.__INITIAL_STATE__`)
            embeddedVariants = result
            break
          }
        } catch { /* not parseable */ }
      }
    }

    // ShopifyAnalytics.meta or embedded "variants" array
    if (src.includes('ShopifyAnalytics') || (src.includes('"variants"') && src.includes('"price"'))) {
      const m = src.match(/"variants"\s*:\s*(\[[\s\S]*?\])/)
      if (m) {
        try {
          const arr = JSON.parse(m[1])
          if (Array.isArray(arr) && arr.length > 1) {
            const seen = new Map<string, ScrapedVariant>()
            for (const v of arr as Array<Record<string, unknown>>) {
              const size = normalizeSize(String(v.title ?? v.name ?? ''))
              if (!size || seen.has(size)) continue
              const price = parsePriceField(v.price ?? v.final_price)
              if (price == null) continue
              const compareAt = parsePriceField(v.compare_at_price ?? null)
              seen.set(size, {
                title: size,
                price,
                compare_at_price: compareAt,
              })
            }
            if (seen.size > 1) {
              console.log(`[scrape:generic] Found ${seen.size} variants in ShopifyAnalytics/embedded JSON`)
              embeddedVariants = [...seen.values()]
              break
            }
          }
        } catch { /* not parseable */ }
      }
    }
  }

  if (embeddedVariants && embeddedVariants.length > 0) {
    console.log(`[scrape:generic] ✓ Embedded variant data, found ${embeddedVariants.length} sizes`)
    return embeddedVariants
  }

  // --- 2b: schema.org JSON-LD structured data ---
  const ldJsonScripts = $html('script[type="application/ld+json"]').toArray()
  console.log(`[scrape:generic] Found ${ldJsonScripts.length} JSON-LD script(s)`)

  for (const el of ldJsonScripts) {
    let ldJson: unknown
    try {
      ldJson = JSON.parse($html(el).text())
    } catch {
      continue
    }

    // Handle both a single object and an array of objects
    const ldObjects: Array<Record<string, unknown>> = Array.isArray(ldJson)
      ? ldJson as Array<Record<string, unknown>>
      : [ldJson as Record<string, unknown>]

    for (const obj of ldObjects) {
      const type = String(obj['@type'] ?? '')
      if (type !== 'ProductGroup' && type !== 'Product') continue

      const hasVariant = obj.hasVariant
      const offers = obj.offers

      // hasVariant entries: price lives in variant.offers sub-object
      // offers entries: price lives directly on the offer (offer.price)
      let candidateVariants: Array<Record<string, unknown>> = []
      let fromOffersArray = false

      if (Array.isArray(hasVariant) && hasVariant.length > 0) {
        candidateVariants = hasVariant as Array<Record<string, unknown>>
      } else if (typeof hasVariant === 'object' && hasVariant != null) {
        candidateVariants = [hasVariant as Record<string, unknown>]
      } else if (Array.isArray(offers) && offers.length > 0) {
        candidateVariants = offers as Array<Record<string, unknown>>
        fromOffersArray = true
      } else if (typeof offers === 'object' && offers != null) {
        candidateVariants = [obj as Record<string, unknown>]
      }

      if (candidateVariants.length === 0) continue

      // Apply variant_filter (from tracked_products.variant_filter) to narrow candidates.
      // e.g. "Hybrid" skips foam-only offers on a mixed-model page.
      if (variantFilter) {
        const filterLower = variantFilter.toLowerCase()
        const before = candidateVariants.length
        candidateVariants = candidateVariants.filter(v => {
          const haystack = [
            v.name, v.sku,
            (v.itemOffered as Record<string, unknown> | undefined)?.name,
          ].filter(Boolean).join(' ').toLowerCase()
          return haystack.includes(filterLower)
        })
        console.log(`[scrape:generic] variant_filter="${variantFilter}" narrowed candidates ${before} → ${candidateVariants.length}`)
      }

      console.log(`[scrape:generic] Found schema.org JSON-LD "${type}" with ${candidateVariants.length} candidate(s) (fromOffers=${fromOffersArray})`)

      const ldSeen = new Map<string, ScrapedVariant>()

      for (const v of candidateVariants) {
        // Size extraction — try fields in order of specificity
        const itemOfferedName = ((v.itemOffered as Record<string, unknown> | undefined)?.name as string | undefined) ?? ''
        const sizeAttempts: Array<unknown> = [
          (v.size as Record<string, unknown> | undefined)?.name,
          (v.size as Record<string, unknown> | undefined)?.value,
          typeof v.size === 'string' ? v.size : undefined,
          // end of "Brand Mattress - Queen" → "Queen"
          itemOfferedName ? itemOfferedName.split(/[-–—]/).pop()?.trim() : undefined,
          String(v.name ?? '').split(/[-–—]/).pop()?.trim(),
          // SKU like "ncc-queen" — normalizeSize will find the keyword
          v.sku,
        ]

        let size: string | null = null
        for (const attempt of sizeAttempts) {
          if (!attempt) continue
          size = normalizeSize(String(attempt))
          if (size) { console.log(`[scrape:generic] JSON-LD size "${size}" extracted from "${attempt}"`); break }
        }

        // For fromOffersArray, also try the ?size= query param on the offer URL
        // e.g. {"url":"...?size=Queen","price":"1889.0"} — used by Leesa and similar brands
        if (!size && fromOffersArray && v.url) {
          const urlSizeMatch = String(v.url).match(/[?&]size=([^&#]+)/)
          if (urlSizeMatch) {
            const decoded = decodeURIComponent(urlSizeMatch[1].replace(/\+/g, ' '))
            size = normalizeSize(decoded)
            if (size) console.log(`[scrape:generic] JSON-LD size "${size}" extracted from offer URL param "${decoded}"`)
          }
        }

        if (!size || ldSeen.has(size)) continue

        // Price extraction differs by source
        let salePrice: number | null = null
        let regularPrice: number | null = null

        if (fromOffersArray) {
          // Each offer is a direct per-size listing — read price from the offer itself,
          // not from the parent product. Try direct price field first, then priceSpecification.
          salePrice = v.price != null ? parseFloat(String(v.price)) : null

          const priceSpecs = Array.isArray(v.priceSpecification)
            ? v.priceSpecification as Array<Record<string, unknown>>
            : []
          if (salePrice == null) {
            const saleSpec = priceSpecs.find(s => String(s.priceType ?? '').includes('SalePrice'))
            const anySpec = priceSpecs[0]
            const raw = saleSpec?.price ?? anySpec?.price ?? null
            if (raw != null) salePrice = parseFloat(String(raw))
          }

          // Regular/list price: priceSpecification with ListPrice type, or compareAtPrice / wasPrice
          const listSpec = priceSpecs.find(s => String(s.priceType ?? '').includes('ListPrice'))
          if (listSpec?.price != null) {
            regularPrice = parseFloat(String(listSpec.price))
          } else {
            const rawCompare = v.compareAtPrice ?? v.wasPrice ?? v.compareAtPriceValue ?? null
            if (rawCompare != null) regularPrice = parseFloat(String(rawCompare))
          }
        } else {
          // hasVariant: price lives in the variant's own offers sub-object
          const varOffers = v.offers as Record<string, unknown> | undefined
          const rawSale = varOffers?.price ?? varOffers?.lowPrice
          const rawRegular = varOffers?.highPrice ?? null
          salePrice = rawSale != null ? parseFloat(String(rawSale)) : null
          regularPrice = rawRegular != null ? parseFloat(String(rawRegular)) : null
        }

        if (salePrice == null || isNaN(salePrice)) continue

        if (ldSeen.size === 0) {
          // Log full offer object for the first variant to help identify available price fields
          console.log(`[scrape:generic] JSON-LD first offer (full):`, JSON.stringify(v).slice(0, 600))
        }
        console.log(`[scrape:generic] JSON-LD size="${size}" sale=$${salePrice} regular=${regularPrice != null ? `$${regularPrice}` : 'null'}`)
        ldSeen.set(size, {
          title: size,
          price: salePrice,
          compare_at_price: regularPrice != null && !isNaN(regularPrice) ? regularPrice : null,
        })
      }

      if (ldSeen.size >= 2) {
        const results = [...ldSeen.values()]
        console.log(`[scrape:generic] ✓ schema.org JSON-LD: ${results.length} sizes extracted`)
        return results
      }
      if (ldSeen.size === 1) {
        console.log(`[scrape:generic] JSON-LD only yielded 1 size — falling through to Approach 3`)
      }
    }
  }

  // --- 2b-magento: Magento configurable product parser ---
  for (const el of inlineScripts) {
    const src = $html(el).text()
    if (!src.includes('"mattress_size"') && !src.includes('"code":"size"')) continue

    console.log('[scrape:generic] Magento config script found, length:', src.length)

    // ── Part 1: sale prices from swatch labels ("Twin XL - $2,879") ──────────
    const salePriceBySize = new Map<string, number>()
    const labelRe = /"(?:value|label)"\s*:\s*"([^"]+?)\s*-\s*\$([0-9,]+)"/g
    let lm: RegExpExecArray | null
    while ((lm = labelRe.exec(src)) !== null) {
      const size = normalizeSize(lm[1] ?? '')
      if (!size || salePriceBySize.has(size)) continue
      const price = parseFloat((lm[2] ?? '').replace(/,/g, ''))
      if (!isNaN(price)) salePriceBySize.set(size, price)
    }
    console.log('[scrape:generic] Magento swatch sale prices:', JSON.stringify([...salePriceBySize.entries()]))

    // Regex-based extraction of oldPrice / regularPrice per product-ID (fallback when JSON parse fails)
    // Matches: "12345": { ... "oldPrice": { "amount": 2879.00 } ... }
    const regularByPidRe = /"(\d{4,})"\s*:\s*\{[^{}]*?"(?:oldPrice|regularPrice|basePrice)"\s*:\s*\{[^}]*?"amount"\s*:\s*([\d.]+)/g
    const regularByPid = new Map<string, number>()
    let rpm: RegExpExecArray | null
    while ((rpm = regularByPidRe.exec(src)) !== null) {
      const pid = rpm[1]!
      const amount = parsePriceField(parseFloat(rpm[2] ?? '0'))
      if (amount != null && amount > 0) regularByPid.set(pid, amount)
    }
    if (regularByPid.size > 0) {
      console.log('[scrape:generic] Magento regex regular prices (by pid):', JSON.stringify([...regularByPid.entries()].slice(0, 5)))
    }

    // ── Part 2: regular prices from optionPrices + index + size options ───────
    // Extract the JSON config object — it lives after a key like "jsonSwatchConfig" or similar.
    // Parse the whole script if it's pure JSON, otherwise extract via brace matching.
    let configJson: Record<string, unknown> | null = null
    if (src.trimStart().startsWith('{')) {
      try { configJson = JSON.parse(src) } catch { /* not pure JSON */ }
    }
    if (!configJson) {
      // Find first '{' and attempt to parse from there
      const brace = src.indexOf('{')
      if (brace !== -1) {
        try { configJson = JSON.parse(src.slice(brace)) } catch { /* partial */ }
      }
    }

    type PriceEntry = {
      oldPrice?: { amount?: number }
      finalPrice?: { amount?: number }
      regularPrice?: { amount?: number }
      basePrice?: { amount?: number }
    }
    type SizeOption = { label?: string; value?: string; products?: string[]; regularPrice?: number | string; oldPrice?: number | string; initialPrice?: number | string }
    type AttrEntry = { code?: string; options?: SizeOption[] }

    const optionPrices = (configJson?.optionPrices ?? configJson?.prices) as Record<string, PriceEntry> | undefined
    const attributes = configJson?.attributes as Record<string, AttrEntry> | undefined

    // Find the size attribute
    let sizeOptions: SizeOption[] = []
    if (attributes) {
      for (const attr of Object.values(attributes)) {
        const code = attr.code ?? ''
        if (code.includes('size') || code.includes('mattress_size')) {
          sizeOptions = attr.options ?? []
          break
        }
      }
    }
    console.log(`[scrape:generic] Magento size options: ${sizeOptions.length}`)

    // ── Part 3: build ScrapedVariant[] ────────────────────────────────────────
    const magentoSeen = new Map<string, ScrapedVariant>()

    for (const opt of sizeOptions) {
      const rawLabel = opt.label ?? opt.value ?? ''
      const size = normalizeSize(rawLabel)
      if (!size || magentoSeen.has(size)) continue

      // Log raw swatch option object for the first size to reveal actual field names
      if (magentoSeen.size === 0) {
        console.log(`[scrape:generic] Magento first swatch opt (raw):`, JSON.stringify(opt))
      }

      // Extract finalPrice (sale/current) and oldPrice/regularPrice (MSRP) from optionPrices
      let magentoSale: number | null = null
      let magentoRegular: number | null = null
      const pid = Array.isArray(opt.products) ? opt.products[0] : undefined
      if (pid && optionPrices) {
        const entry = optionPrices[pid]
        console.log(`[scrape:generic] Magento optionPrices[${pid}] for "${rawLabel}":`, JSON.stringify(entry)?.slice(0, 400))
        if (entry?.finalPrice?.amount != null) magentoSale = parsePriceField(entry.finalPrice.amount)
        // oldPrice and regularPrice are both used as the MSRP field depending on Magento version
        const rawRegular = entry?.oldPrice?.amount ?? entry?.regularPrice?.amount ?? entry?.basePrice?.amount ?? null
        if (rawRegular != null) magentoRegular = parsePriceField(rawRegular)
      }
      // Regex fallback when JSON parse produced null configJson
      if (magentoRegular == null && pid) {
        const regexRegular = regularByPid.get(pid)
        if (regexRegular != null) magentoRegular = regexRegular
      }

      // Also read price fields directly from the option object itself
      if (magentoRegular == null) {
        const optRaw = opt.regularPrice ?? opt.oldPrice ?? opt.initialPrice ?? null
        if (optRaw != null) {
          const optVal = typeof optRaw === 'string' ? parseFloat(optRaw) : Number(optRaw)
          const optParsed = isNaN(optVal) ? null : parsePriceField(optVal)
          if (optParsed != null && (magentoSale == null || optParsed !== magentoSale)) {
            magentoRegular = optParsed
          }
        }
      }

      // Swatch label price overrides finalPrice for sale (more human-readable; label is in $)
      const labelSale = salePriceBySize.get(size) ?? null
      const effectiveSale = labelSale ?? magentoSale ?? null

      // Only treat oldPrice as a regular/MSRP when it's strictly higher than the sale price
      const effectiveRegular = magentoRegular != null && effectiveSale != null && magentoRegular > effectiveSale
        ? magentoRegular
        : null

      if (effectiveSale == null && effectiveRegular == null) {
        console.log(`[scrape:generic] Magento: no price for size "${rawLabel}"`)
        continue
      }

      console.log(`[scrape:generic] Magento size="${size}" sale=${effectiveSale != null ? `$${effectiveSale}` : 'null'} regular=${effectiveRegular != null ? `$${effectiveRegular}` : 'null'}`)
      magentoSeen.set(size, {
        title: size,
        price: effectiveSale ?? effectiveRegular!,
        compare_at_price: effectiveRegular,
      })
    }

    // If label-regex got prices but sizeOptions was empty (config not fully parsed),
    // fall back to just the label-extracted prices
    if (magentoSeen.size === 0 && salePriceBySize.size >= 2) {
      for (const [size, labelSale] of salePriceBySize) {
        magentoSeen.set(size, { title: size, price: labelSale, compare_at_price: null })
      }
    }

    if (magentoSeen.size >= 2) {
      const results = [...magentoSeen.values()]
      console.log(`[scrape:generic] ✓ Magento: ${results.length} sizes extracted`)
      return results
    }
    console.log(`[scrape:generic] Magento: only ${magentoSeen.size} size(s) — falling through`)
    break
  }


  // --- 2c: Dollar amounts near size keywords ---
  // If ?size= param present, only scan for that specific size
  const sizeParam = urlObj.searchParams.get('size')
  const ALL_SIZE_KEYWORDS: Array<[string, string]> = [
    ['Twin XL', 'Twin XL'],
    ['California King', 'Cal King'],
    ['Cal King', 'Cal King'],
    ['Twin', 'Twin'],
    ['Full', 'Full'],
    ['Queen', 'Queen'],
    ['King', 'King'],
  ]

  let sizeKeywordsToScan = ALL_SIZE_KEYWORDS
  if (sizeParam) {
    const canonical = normalizeSize(sizeParam)
    if (canonical) {
      console.log(`[scrape:generic] ?size= param found: ${sizeParam} — scanning for that size only`)
      sizeKeywordsToScan = ALL_SIZE_KEYWORDS.filter(([, cs]) => cs === canonical)
    } else {
      console.log(`[scrape:generic] ?size= param "${sizeParam}" not recognized — scanning all sizes`)
    }
  }

  // --- Debug: global price signals ---
  const allDollarAmounts = [...html.matchAll(/\$[\d,]+(?:\.\d{2})?/g)].map(m => m[0])
  console.log('[scrape:generic] Dollar amounts in HTML:', allDollarAmounts.slice(0, 20))

  const twinIdx = html.indexOf('Twin')
  if (twinIdx !== -1) {
    console.log('[scrape:generic] "Twin" context:', html.slice(Math.max(0, twinIdx - 100), twinIdx + 100))
  } else {
    console.log('[scrape:generic] "Twin" not found in HTML')
  }

  for (const needle of ['749', '2149']) {
    const nIdx = html.indexOf(needle)
    if (nIdx !== -1) {
      console.log(`[scrape:generic] "${needle}" found at ${nIdx}:`, html.slice(Math.max(0, nIdx - 80), nIdx + 80))
    } else {
      console.log(`[scrape:generic] "${needle}" not found in HTML`)
    }
  }

  // Find first script tag with price data
  for (const el of inlineScripts) {
    const src = $html(el).text()
    if (src.includes('"price"') || src.includes("'price'")) {
      console.log(`[scrape:generic] First script with "price" key (length=${src.length}):`, src.slice(0, 500))
      break
    }
  }

  // Coupon-based sale price is only reliable as a single-size signal — only use it
  // when ?size= param is present so we aren't applying one price to every size.
  let inlineSalePrice: number | null = null
  if (sizeParam) {
    const couponMatch = html.match(/\$(\d[\d,]+(?:\.\d{2})?)\s+with\s+code/i)
                     ?? html.match(/sale[^$]{0,50}\$(\d[\d,]+(?:\.\d{2})?)/i)
    inlineSalePrice = couponMatch ? parseFloat(couponMatch[1].replace(/,/g, '')) : null
    if (inlineSalePrice != null) {
      console.log(`[scrape:generic] Found inline sale price (single-size mode): $${inlineSalePrice}`)
    }
  }

  const dollarRe = /\$\s*([\d,]+(?:\.\d{2})?)/g
  const WINDOW = 600
  const sizeMap = new Map<string, ScrapedVariant>()

  for (const [keyword, canonicalSize] of sizeKeywordsToScan) {
    if (sizeMap.has(canonicalSize)) continue

    let idx = html.indexOf(keyword)
    if (idx === -1) continue

    while (idx !== -1) {
      const start = Math.max(0, idx - WINDOW)
      const end = Math.min(html.length, idx + keyword.length + WINDOW)
      const snippet = html.slice(start, end)

      const prices = [...snippet.matchAll(dollarRe)]
        .map(m => parseFloat((m[1] ?? '0').replace(/,/g, '')))
        .filter(p => p > 200)

      if (prices.length > 0) {
        const listPrice = Math.max(...prices)
        const currentPrice = inlineSalePrice ?? (prices.length > 1 ? Math.min(...prices) : null)
        console.log(`[scrape:generic] "${canonicalSize}" sale=${currentPrice != null ? `$${currentPrice}` : 'null'} regular=$${listPrice}`)
        sizeMap.set(canonicalSize, {
          title: canonicalSize,
          price: currentPrice ?? listPrice,
          compare_at_price: currentPrice != null ? listPrice : null,
        })
        break
      }
      idx = html.indexOf(keyword, idx + 1)
    }
  }

  if (sizeMap.size > 0) {
    const variants = [...sizeMap.values()]
    if (variants.length === 1 && !sizeParam) {
      console.log(`[scrape:generic] ✓ HTML approach, captured 1 size (${variants[0].title}) — add separate products per size if needed`)
    } else {
      console.log(`[scrape:generic] ✓ HTML approach, found ${variants.length} sizes`)
    }
    return variants
  }

  console.log('[scrape:generic] No prices extracted from HTML — returning empty result')
  return []
}

async function residentHomeFetch(url: string): Promise<Response> {
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

async function scrapePuffy(url: string, variantFilter?: string | null): Promise<ScrapedVariant[]> {
  console.log(`[scrape:puffy] url="${url}"`)
  const urlObj = new URL(url)
  const jsonUrl = `${urlObj.origin}${urlObj.pathname.replace(/\/$/, '')}.json`
  console.log(`[scrape:puffy] Trying Shopify JSON: ${jsonUrl}`)

  try {
    const jsonRes = await fetch(jsonUrl, { headers: BROWSER_HEADERS })
    console.log(`[scrape:puffy] Shopify JSON status: ${jsonRes.status}`)
    if (jsonRes.ok) {
      const data = await jsonRes.json() as Record<string, unknown>
      const variants = ((data?.product as Record<string, unknown> | undefined)?.variants) as Array<Record<string, unknown>> | undefined

      if (Array.isArray(variants) && variants.length > 0) {
        const seen = new Map<string, ScrapedVariant>()
        for (const v of variants) {
          const rawOpt = String(v.option1 ?? '')
          if (variantFilter && !rawOpt.toLowerCase().includes(variantFilter.toLowerCase())) continue
          const size = normalizeSize(rawOpt)
          if (!size || seen.has(size)) continue
          const salePrice = v.price != null ? parseFloat(String(v.price)) : null
          const regularPrice = v.compare_at_price != null && v.compare_at_price !== '' && v.compare_at_price !== '0.00'
            ? parseFloat(String(v.compare_at_price))
            : null
          if (!salePrice || isNaN(salePrice)) continue
          const hasReal = regularPrice != null && !isNaN(regularPrice) && regularPrice > salePrice
          console.log(`[scrape:puffy] JSON size="${size}" sale=$${salePrice} regular=${hasReal ? `$${regularPrice}` : 'null'}`)
          seen.set(size, {
            title: size,
            price: salePrice,
            compare_at_price: hasReal ? regularPrice! : null,
          })
        }

        if (seen.size >= 2) {
          const hasCompareAt = [...seen.values()].some(v => v.compare_at_price != null)
          if (hasCompareAt) {
            console.log(`[scrape:puffy] ✓ Shopify JSON with compare_at: ${seen.size} sizes`)
            return [...seen.values()]
          }

          // JSON has prices but no compare_at — scan HTML for regular/MSRP price
          console.log(`[scrape:puffy] JSON has no compare_at — scanning HTML for regular prices`)
          try {
            const htmlRes = await fetch(url, { headers: { ...BROWSER_HEADERS, Referer: urlObj.origin + '/' } })
            if (htmlRes.ok) {
              const html = await htmlRes.text()
              const $p = load(html)

              // ── Approach A: comprehensive inline script scan for compare_at_price ──
              const inlineScripts = $p('script:not([src])').toArray()
              console.log(`[scrape:puffy] Scanning ${inlineScripts.length} inline scripts`)

              // Log a 500-char window around the first compare_at_price anywhere in HTML
              const firstCatIdx = html.indexOf('compare_at_price')
              if (firstCatIdx !== -1) {
                const w0 = Math.max(0, firstCatIdx - 100), w1 = Math.min(html.length, firstCatIdx + 400)
                console.log(`[scrape:puffy] First compare_at_price in HTML at offset ${firstCatIdx}:`, html.slice(w0, w1))
              } else {
                console.log(`[scrape:puffy] compare_at_price not found anywhere in raw HTML`)
              }

              const compareAtBySize = new Map<string, number>()
              let loggedFirstVariant = false

              for (const el of inlineScripts) {
                const $el = $p(el)
                const scriptType = ($el.attr('type') ?? '').toLowerCase()
                const scriptId = ($el.attr('id') ?? '').toLowerCase()
                const src = $el.text().trim()
                if (!src) continue

                const hasCompareAt = src.includes('compare_at_price') || src.includes('compareAtPrice')
                const isJsonScript = scriptType === 'application/json' || scriptType.includes('json')
                const isProductScript = scriptId.includes('product') || scriptId.includes('variant')
                const hasVariants = src.includes('"variants"') && src.includes('"price"')
                const hasShopifyGlobals = src.includes('ShopifyAnalytics') || src.includes('window.__st') || src.includes('window.meta')

                // Discovery logging — runs before candidate filter so we always capture these
                if (isJsonScript) {
                  console.log(`[scrape:puffy] <application/json> script first 1000 chars:`, src.slice(0, 1000))
                }
                const catInSrc = src.indexOf('compare_at') !== -1 ? src.indexOf('compare_at')
                  : src.indexOf('compareAt') !== -1 ? src.indexOf('compareAt') : -1
                if (catInSrc !== -1) {
                  const sw0 = Math.max(0, catInSrc - 100), sw1 = Math.min(src.length, catInSrc + 400)
                  console.log(`[scrape:puffy] Script has compare_at/compareAt at offset ${catInSrc}:`, src.slice(sw0, sw1))
                }
                if (hasVariants && !loggedFirstVariant) {
                  const vmatch = src.match(/"variants"\s*:\s*(\[[\s\S]*?\])/)
                  if (vmatch) {
                    try {
                      const varr = JSON.parse(vmatch[1]) as Array<Record<string, unknown>>
                      if (varr.length > 0) {
                        console.log(`[scrape:puffy] First variant (full) in script:`, JSON.stringify(varr[0]))
                        loggedFirstVariant = true
                      }
                    } catch { /* not parseable */ }
                  }
                }

                if (!hasCompareAt && !isJsonScript && !isProductScript && !hasVariants && !hasShopifyGlobals) continue

                console.log(`[scrape:puffy] Candidate script type="${scriptType}" id="${scriptId}" len=${src.length} hasCompareAt=${hasCompareAt}`)

                // Log Shopify global objects for discovery
                if (hasShopifyGlobals) {
                  for (const re of [/ShopifyAnalytics\.meta\s*=\s*(\{[^}]*\})/g, /window\.__st\s*=\s*(\{[^}]*\})/g, /window\.meta\s*=\s*(\{[^}]*\})/g]) {
                    const m = re.exec(src)
                    if (m) console.log(`[scrape:puffy] Shopify global match:`, m[0].slice(0, 400))
                  }
                }

                // Pattern 1: "variants": [...] — grab first variant for discovery, extract compare_at
                const variantsMatch = src.match(/"variants"\s*:\s*(\[[\s\S]*?\])/)
                if (variantsMatch) {
                  try {
                    const arr = JSON.parse(variantsMatch[1]) as Array<Record<string, unknown>>
                    if (arr.length > 0) {
                      console.log(`[scrape:puffy] First variant fields:`, JSON.stringify(arr[0]))
                      for (const v of arr) {
                        const size = normalizeSize(String(v.title ?? v.option1 ?? ''))
                        if (!size || !seen.has(size)) continue
                        const cat = parsePriceField(v.compare_at_price ?? v.compareAtPrice ?? null)
                        if (cat != null && cat > seen.get(size)!.price) compareAtBySize.set(size, cat)
                      }
                    }
                  } catch { /* not parseable */ }
                }

                // Pattern 2: application/json or product script — try tryParseVariants
                if (compareAtBySize.size === 0 && (isJsonScript || isProductScript) && src.length < 100_000) {
                  try {
                    const result = tryParseVariants(JSON.parse(src))
                    if (result && result.length > 0) {
                      console.log(`[scrape:puffy] application/json first variant:`, JSON.stringify(result[0]).slice(0, 400))
                      for (const v of result) {
                        const size = normalizeSize(v.title)
                        if (!size || !seen.has(size) || v.compare_at_price == null) continue
                        if (v.compare_at_price > seen.get(size)!.price) compareAtBySize.set(size, v.compare_at_price)
                      }
                    }
                  } catch { /* not parseable */ }
                }

                if (compareAtBySize.size > 0) break
              }

              console.log(`[scrape:puffy] Inline compare_at found for: ${[...compareAtBySize.keys()].join(', ') || 'none'}`)

              if (compareAtBySize.size > 0) {
                const updated = new Map<string, ScrapedVariant>([...seen])
                for (const [size, regularPrice] of compareAtBySize) {
                  const existing = updated.get(size)!
                  updated.set(size, { ...existing, compare_at_price: regularPrice })
                  console.log(`[scrape:puffy] Inline "${size}" sale=$${existing.price} regular=$${regularPrice}`)
                }
                console.log(`[scrape:puffy] ✓ Shopify JSON + inline script compare_at: ${updated.size} sizes`)
                return [...updated.values()]
              }

              // ── Approach B: CSS selectors for struck-through prices near size keywords ──
              const STRIKE_SEL = [
                '.compare-at-price', '.price--compare', '.was-price', '.original-price',
                '[class*="compare-at"]', '[class*="compare_at"]', '[class*="was-price"]',
                '[class*="original-price"]', '[style*="line-through"]', 'del', 's',
              ].join(',')

              const SIZE_KW: Array<[string, string]> = [
                ['California King', 'Cal King'], ['Cal King', 'Cal King'], ['Twin XL', 'Twin XL'],
                ['Twin', 'Twin'], ['Full', 'Full'], ['Queen', 'Queen'], ['King', 'King'],
              ]
              const WINDOW = 600
              const updated = new Map<string, ScrapedVariant>([...seen])
              let anyUpdated = false

              for (const [keyword, canonicalSize] of SIZE_KW) {
                if (!seen.has(canonicalSize)) continue
                let idx = html.indexOf(keyword)
                while (idx !== -1) {
                  const start = Math.max(0, idx - WINDOW)
                  const end = Math.min(html.length, idx + keyword.length + WINDOW)
                  const snippet = html.slice(start, end)
                  const $s = load(snippet)
                  let regularPrice: number | null = null
                  $s(STRIKE_SEL).each((_, el) => {
                    const m = $s(el).text().match(/\$([\d,]+(?:\.\d{2})?)/)
                    if (m) {
                      const p = parseFloat(m[1].replace(/,/g, ''))
                      if (p > 200 && (regularPrice === null || p > regularPrice)) regularPrice = p
                    }
                  })
                  if (regularPrice !== null) {
                    const existing = seen.get(canonicalSize)!
                    if (regularPrice > existing.price) {
                      console.log(`[scrape:puffy] CSS "${canonicalSize}" sale=$${existing.price} regular=$${regularPrice}`)
                      updated.set(canonicalSize, { title: canonicalSize, price: existing.price, compare_at_price: regularPrice })
                      anyUpdated = true
                      break
                    }
                  }
                  idx = html.indexOf(keyword, idx + 1)
                }
              }

              if (anyUpdated) {
                console.log(`[scrape:puffy] ✓ Shopify JSON + CSS strikethrough: ${updated.size} sizes`)
                return [...updated.values()]
              }
            }
          } catch (htmlErr) {
            console.log(`[scrape:puffy] HTML scan error:`, htmlErr instanceof Error ? htmlErr.message : htmlErr)
          }

          console.log(`[scrape:puffy] ✓ Shopify JSON only (no regular price found): ${seen.size} sizes`)
          return [...seen.values()]
        }
      }
    }
  } catch (err) {
    console.log(`[scrape:puffy] Shopify JSON error:`, err instanceof Error ? err.message : err)
  }

  console.log(`[scrape:puffy] Falling back to scrapeGeneric`)
  return scrapeGeneric(url, variantFilter)
}

async function scrapeWinkBeds(url: string, variantFilter?: string | null): Promise<ScrapedVariant[]> {
  let resolvedUrl = url
  if (url.includes('/pages/')) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BedSync/1.0)' } })
    const html = await res.text()

    const analyticsMatch = html.match(/ShopifyAnalytics\.meta\.product\.handle\s*[=:]\s*["']([^"']+)["']/)
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/products\/([^"'?/]+)["']/)
    const productsMatch = html.match(/["']\/products\/([a-z0-9][a-z0-9\-]+)["']/)

    const handle = analyticsMatch?.[1] ?? canonicalMatch?.[1] ?? productsMatch?.[1] ?? null
    if (!handle) {
      console.log(`[scrape:winkbeds] Could not extract product handle from /pages/ URL — falling back to generic`)
      return scrapeGeneric(url, variantFilter)
    }
    resolvedUrl = `https://www.winkbeds.com/products/${handle}`
    console.log(`[scrape:winkbeds] Resolved /pages/ URL → /products/${handle}`)
  }
  return scrapeGeneric(resolvedUrl, variantFilter)
}

const TEMPURPEDIC_SIZE_MAP: Record<string, string> = {
  'Twin': 'Twin',
  'Twin Long': 'Twin XL',
  'Full': 'Full',
  'Queen': 'Queen',
  'King': 'King',
  'CA King': 'Cal King',
}
const TEMPURPEDIC_SIZE_SKIP = new Set(['Split King', 'Split CA King', 'RV King'])

async function scrapeTempurpedic(url: string, productName?: string): Promise<ScrapedVariant[]> {
  console.log(`[scrape:tempurpedic] url="${url}" productName="${productName ?? ''}"`)
  const res = await fetch(url, { headers: BROWSER_HEADERS })
  console.log(`[scrape:tempurpedic] HTML status: ${res.status}`)
  if (!res.ok) throw new Error(`HTML fetch failed: ${res.status}`)
  const html = await res.text()

  const $ = load(html)
  const ldJsonScripts = $('script[type="application/ld+json"]').toArray()
  console.log(`[scrape:tempurpedic] Found ${ldJsonScripts.length} JSON-LD script(s)`)

  // Collect all Product entries from all JSON-LD blocks
  const allProducts: Array<Record<string, unknown>> = []
  for (const el of ldJsonScripts) {
    let parsed: unknown
    try { parsed = JSON.parse($(el).text()) } catch { continue }
    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if ((item as Record<string, unknown>)?.['@type'] === 'Product') {
        allProducts.push(item as Record<string, unknown>)
      }
    }
  }
  console.log(`[scrape:tempurpedic] Product entries: ${allProducts.length}`)

  if (allProducts.length === 0) {
    const isWAFBlock = html.includes('aws-waf') || html.toLowerCase().includes('captcha') || html.length < 5000
    if (isWAFBlock) {
      console.error(`[scrape:tempurpedic] WAF/captcha challenge detected (html=${html.length} bytes) — JS rendering required, but scrapeTempurpedic uses direct fetch. No variants returned.`)
    } else {
      console.error(`[scrape:tempurpedic] No JSON-LD Product entries found (html=${html.length} bytes) — page may require JS rendering. No variants returned.`)
    }
    return []
  }

  // Filter by keywords from the requested product name to avoid bleeding across
  // products that share a page (e.g. Cloud Hybrid vs Cloud Memory Foam).
  let products = allProducts
  if (productName) {
    const keywords = productName.toLowerCase().split(/\s+/).filter(k => k.length > 2)
    if (keywords.length > 0) {
      const filtered = allProducts.filter(p =>
        keywords.every(k => String(p.name ?? '').toLowerCase().includes(k))
      )
      if (filtered.length > 0) {
        console.log(`[scrape:tempurpedic] keyword filter "${productName}" → ${filtered.length}/${allProducts.length} entries`)
        products = filtered
      } else {
        console.log(`[scrape:tempurpedic] keyword filter "${productName}" matched nothing — using all ${allProducts.length}`)
      }
    }
  }

  // Derive base model name from the first (filtered) entry by stripping the size suffix.
  // Breeze products use ", CA King" (comma) while other products use " - Queen" (dash).
  const firstName = String(products[0]?.name ?? '')
  const COMMA_SIZES = ['Split CA King', 'Split King', 'RV King', 'Twin Long', 'CA King', 'King', 'Queen', 'Full', 'Twin']
  const trailingCommaSize = COMMA_SIZES.find(s => firstName.endsWith(', ' + s))
  const baseModel = trailingCommaSize
    ? firstName.slice(0, firstName.length - trailingCommaSize.length - 2).trim()
    : firstName.includes(' - ')
    ? firstName.slice(0, firstName.lastIndexOf(' - ')).trim()
    : firstName
  console.log(`[scrape:tempurpedic] Base model: "${baseModel}"`)

  const seen = new Map<string, ScrapedVariant>()

  for (const entry of products) {
    const name = String(entry.name ?? '')
    if (!name.startsWith(baseModel)) continue

    // Size is the part after " - " (most products) or ", " (Breeze collection)
    const suffix = name.includes(' - ')
      ? name.slice(name.lastIndexOf(' - ') + 3).trim()
      : name.startsWith(baseModel + ', ')
      ? name.slice(baseModel.length + 2).trim()
      : ''
    if (TEMPURPEDIC_SIZE_SKIP.has(suffix)) {
      console.log(`[scrape:tempurpedic] Skipping "${suffix}"`)
      continue
    }
    const mappedSize = TEMPURPEDIC_SIZE_MAP[suffix]
    if (!mappedSize) {
      console.log(`[scrape:tempurpedic] Unknown size suffix "${suffix}" in "${name}" — skipping`)
      continue
    }
    if (seen.has(mappedSize)) continue

    const offers = entry.offers as Record<string, unknown> | undefined
    const rawPrice = offers?.price
    const price = rawPrice != null ? parseFloat(String(rawPrice)) : null
    if (price == null || isNaN(price) || price === 0) {
      console.log(`[scrape:tempurpedic] No valid price for "${name}"`)
      continue
    }

    console.log(`[scrape:tempurpedic] size="${mappedSize}" price=$${price}`)
    seen.set(mappedSize, { title: mappedSize, price, compare_at_price: null })
  }

  const results = [...seen.values()]
  console.log(`[scrape:tempurpedic] ✓ ${results.length} size(s) extracted`)
  return results
}

export async function scrapeForBrand(brand: string, url: string, variantFilter?: string | null, productName?: string, apiProductName?: string): Promise<ScrapedVariant[]> {
  const normalizedBrand = brand.toLowerCase()
  if (normalizedBrand === 'helix') return scrapeHelix(url)
  if (normalizedBrand === 'birch') return scrapeHelix(url)
  if (normalizedBrand === 'nectar') return scrapeNectar(url, variantFilter, 'nectar', apiProductName)
  if (normalizedBrand === 'dreamcloud') return scrapeNectar(url, variantFilter, 'dreamcloud', apiProductName)
  if (normalizedBrand === 'puffy') return scrapePuffy(url, variantFilter)
  if (normalizedBrand === 'winkbeds') return scrapeWinkBeds(url, variantFilter)
  if (normalizedBrand === 'tempurpedic') return scrapeTempurpedic(url, productName)
  return scrapeGeneric(url, variantFilter)
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function runScrape(tracked_product_id: string, supabase: SupabaseClient): Promise<Response> {
  try {
    const { data: product, error: productError } = await createAdminClient()
      .from('tracked_products')
      .select('*')
      .eq('id', tracked_product_id)
      .single()

    if (productError || !product) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    let brand: string = product.brand ?? ''
    const variantFilter: string | null = product.variant_filter ?? null
    console.log(`[scrape] brand="${brand}" url="${product.manufacturer_url}" variant_filter=${variantFilter ?? 'none'}`)

    if (!brand) {
      try {
        const hostname = new URL(product.manufacturer_url).hostname.replace('www.', '')
        brand = hostname.split('.')[0]
        console.log(`[scrape] brand was empty — derived "${brand}" from hostname`)
      } catch {
        return Response.json({ error: 'Product has no brand and URL is invalid' }, { status: 400 })
      }
    }

    const now = new Date().toISOString()

    const catalogBrand = CATALOG.find(b => b.slug === brand.toLowerCase())
    const catalogEntry = catalogBrand?.products.find(e => e.name.toLowerCase() === (product.label ?? '').toLowerCase())
    const apiProductName = catalogEntry?.apiProductName

    const isHelix = brand.toLowerCase() === 'helix' || brand.toLowerCase() === 'birch'
    const maxAttempts = isHelix ? 1 : 3

    let scraped: ScrapedVariant[] | null = null
    let lastScrapeError: string | null = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        scraped = await scrapeForBrand(brand, product.manufacturer_url, variantFilter, product.label ?? undefined, apiProductName)
        break
      } catch (err) {
        lastScrapeError = err instanceof Error ? err.message : String(err)
        // Proxy timeouts and total fetch failures have no chance of succeeding on retry — bail immediately
        const isFatal = lastScrapeError.includes('timed out') || lastScrapeError.includes('All ScraperAPI')
        if (isFatal) {
          console.log(`[scrape] fatal error, not retrying: ${lastScrapeError}`)
          break
        }
        if (attempt < maxAttempts) {
          console.log(`[scrape] attempt ${attempt}/${maxAttempts} after failure: ${lastScrapeError}`)
          await new Promise(r => setTimeout(r, 2000))
        } else {
          console.error(`[scrape] Failed for brand="${brand}" after ${maxAttempts} attempt(s):`, err instanceof Error ? err.stack : err)
        }
      }
    }

    if (scraped === null) {
      const isHelixCloudflare = isHelix && (lastScrapeError?.includes('timed out') || lastScrapeError?.includes('All ScraperAPI') || lastScrapeError?.includes('fetch failed'))
      const userError = isHelixCloudflare
        ? 'Helix temporarily unavailable — Cloudflare is blocking scrapers. Try again later.'
        : 'Unsupported brand or scrape failed'
      await supabase.from('tracked_products').update({
        scrape_status: 'error',
        scrape_error: lastScrapeError,
        scrape_attempted_at: now,
      }).eq('id', tracked_product_id)
      return Response.json({ error: userError, brand, detail: lastScrapeError }, { status: 400 })
    }

    console.log(`[scrape] Extracted ${scraped.length} raw variants`)
    const priceRows: Array<{
      tracked_product_id: string
      size: string
      regular_price: number | null
      sale_price: number
      scraped_at: string
    }> = []

    for (const v of scraped) {
      const size = normalizeSize(v.title)
      if (!size) {
        console.log(`[scrape] Skipping unrecognized variant title: "${v.title}"`)
        continue
      }

      const salePrice = v.price             // current price consumers pay
      const regularPrice = v.compare_at_price  // MSRP/list price, or null if no active sale

      console.log(`[scrape] size="${size}" sale=${salePrice} regular=${regularPrice ?? 'null'}`)
      priceRows.push({ tracked_product_id, size, regular_price: regularPrice, sale_price: salePrice, scraped_at: now })
    }

    // Fetch previous prices for spike detection before inserting new ones
    const { data: prevPricesData } = await createAdminClient()
      .from('prices')
      .select('size, sale_price')
      .eq('tracked_product_id', tracked_product_id)
      .order('scraped_at', { ascending: false })
      .limit(100)

    const prevBySize: Record<string, number> = {}
    for (const row of (prevPricesData ?? [])) {
      if (prevBySize[row.size] == null) prevBySize[row.size] = row.sale_price
    }

    // Health checks
    let scrapeStatus: 'ok' | 'warning' | 'error' = 'ok'
    let healthWarning: string | null = null

    if (priceRows.length === 0) {
      scrapeStatus = 'warning'
      healthWarning = 'No recognizable size variants found'
    } else {
      const zeroPrices = priceRows.filter(r => r.sale_price === 0)
      if (zeroPrices.length > 0) {
        scrapeStatus = 'warning'
        healthWarning = `$0 price for: ${zeroPrices.map(r => r.size).join(', ')}`
      }
      if (scrapeStatus === 'ok') {
        for (const row of priceRows) {
          const prev = prevBySize[row.size]
          if (prev != null && prev > 0) {
            const change = Math.abs(row.sale_price - prev) / prev
            if (change > 0.6) {
              scrapeStatus = 'warning'
              healthWarning = `${row.size} price changed ${Math.round(change * 100)}% ($${prev} → $${row.sale_price})`
              break
            }
          }
        }
      }
    }

    console.log(`[scrape] health: ${scrapeStatus}${healthWarning ? ` — ${healthWarning}` : ''}`)
    await supabase.from('tracked_products').update({
      scrape_status: scrapeStatus,
      scrape_error: healthWarning,
      scrape_attempted_at: now,
    }).eq('id', tracked_product_id)

    if (priceRows.length === 0) {
      return Response.json({ error: 'No recognizable size variants found', scraped }, { status: 422 })
    }

    const { error: insertError } = await createAdminClient().from('prices').upsert(priceRows, { onConflict: 'tracked_product_id,size' })
    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    // If this insert fails with "relation does not exist", run:
    // supabase/migrations/20260702000000_price_history_sync_events.sql
    const historyRows = priceRows.map(r => ({
      product_id: r.tracked_product_id,
      size: r.size,
      sale_price: r.sale_price,
      regular_price: r.regular_price,
      recorded_at: r.scraped_at,
    }))
    const { error: historyError } = await createAdminClient().from('price_history').insert(historyRows)
    if (historyError) {
      console.error(`[scrape] price_history insert error:`, historyError.message)
    } else {
      console.log(`[scrape] price_history insert: ${historyRows.length} rows`)
    }

    await supabase
      .from('tracked_products')
      .update({ last_synced_at: now })
      .eq('id', tracked_product_id)

    return Response.json({ success: true, sizes: priceRows.map(r => r.size) })
  } catch (err) {
    console.error('[scrape] Unhandled error:', err instanceof Error ? err.stack : err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { tracked_product_id } = body
  if (!tracked_product_id) {
    return Response.json({ error: 'tracked_product_id required' }, { status: 400 })
  }
  const supabase = await createClient()
  return runScrape(tracked_product_id, supabase)
}
