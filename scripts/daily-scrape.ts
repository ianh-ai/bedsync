import * as fs from 'fs'
import * as path from 'path'

// Local-only convenience: GitHub Actions sets these as real job env vars, but
// running this script directly via ts-node needs .env.local loaded manually.
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] ??= m[2].trim()
  }
}

import { createClient } from '@supabase/supabase-js'
import { scrapeForBrand, normalizeSize, type ScrapedVariant } from '@/lib/scrapers'
import { BRAND_CONFIGS, type BrandConfig } from './brand-configs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BRIGHT_DATA_WS = process.env.BRIGHT_DATA_WS

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[daily-scrape] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}
if (!BRIGHT_DATA_WS) {
  console.error('[daily-scrape] Missing BRIGHT_DATA_WS')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const BATCH_SIZE = 8
const RETENTION_DAYS = 7

type PriceRow = {
  brand: string
  url: string
  variant_filter: string | null
  size: string
  regular_price: number
  sale_price: number | null
  scraped_at: string
}

// regular_price is always the list price (never null); sale_price is only set
// when there's an active discount. This mirrors what the sync route expects:
// newPrice = sale_price ?? regular_price, newCompareAt = regular_price if > newPrice.
function toPriceRows(config: BrandConfig, variants: ScrapedVariant[], scrapedAt: string): PriceRow[] {
  const rows: PriceRow[] = []
  for (const v of variants) {
    const size = normalizeSize(v.title)
    if (!size) continue
    const hasSale = v.compare_at_price != null && v.compare_at_price > v.price
    rows.push({
      brand: config.brand,
      url: config.url,
      variant_filter: config.variant_filter,
      size,
      regular_price: hasSale ? v.compare_at_price! : v.price,
      sale_price: hasSale ? v.price : null,
      scraped_at: scrapedAt,
    })
  }
  return rows
}

async function scrapeOne(config: BrandConfig): Promise<{ rows: PriceRow[] } | { error: string }> {
  const scrapedAt = new Date().toISOString()
  // No shared browser passed — scrapeForBrand opens its own Bright Data session
  // per call. Bright Data's Scraping Browser caps the number of distinct domains
  // navigable within a single CDP connection, so one shared session can't be
  // reused across ~14 different brand domains in this batch.
  const attemptScrape = () => scrapeForBrand(
    config.brand,
    config.url,
    config.variant_filter,
    config.product_name,
    config.api_product_name
  )

  try {
    let variants
    try {
      variants = await attemptScrape()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Timeout') || message.includes('ERR_TIMED_OUT')) {
        console.log(`[daily-scrape] retrying after timeout: ${config.url}`)
        await new Promise(r => setTimeout(r, 5000))
        variants = await attemptScrape()
      } else {
        throw err
      }
    }

    const rows = toPriceRows(config, variants, scrapedAt)
    if (rows.length === 0) return { error: 'No recognizable size variants found' }
    return { rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(fn))
  }
}

function labelFor(config: BrandConfig): string {
  return `${config.brand} ${config.url}${config.variant_filter ? ` (${config.variant_filter})` : ''}`
}

async function main() {
  console.log(`[daily-scrape] Starting — ${BRAND_CONFIGS.length} configured product(s)`)

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error: deleteError, count } = await admin
    .from('brand_prices')
    .delete({ count: 'exact' })
    .lt('scraped_at', cutoff)
  if (deleteError) {
    console.error(`[daily-scrape] Cleanup failed:`, deleteError.message)
  } else {
    console.log(`[daily-scrape] Cleanup: deleted ${count ?? 0} row(s) older than ${RETENTION_DAYS} days`)
  }

  let succeeded = 0
  let failed = 0

  await runInBatches(BRAND_CONFIGS, BATCH_SIZE, async (config) => {
    const label = labelFor(config)
    const result = await scrapeOne(config)

    if ('error' in result) {
      failed++
      console.error(`[daily-scrape] ✗ ${label}: ${result.error}`)
      return
    }

    const { error: insertError } = await admin.from('brand_prices').insert(result.rows)
    if (insertError) {
      failed++
      console.error(`[daily-scrape] ✗ ${label}: insert failed — ${insertError.message}`)
      return
    }

    succeeded++
    console.log(`[daily-scrape] ✓ ${label}: ${result.rows.length} size(s)`)
  })

  console.log(`[daily-scrape] Done — ${succeeded} succeeded, ${failed} failed`)
  if (succeeded === 0 && failed > 0) process.exit(1)
}

main()
