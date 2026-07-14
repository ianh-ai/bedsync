import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.local manually (not a Next.js context)
const envPath = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq)
  const val = trimmed.slice(eq + 1)
  if (!process.env[key]) process.env[key] = val
}

import { createClient } from '@supabase/supabase-js'

const WEBHOOK_ADDRESS = 'https://bedsync.net/api/webhooks/shopify'
const COMPLIANCE_TOPICS = ['customers/data_request', 'customers/redact', 'shop/redact'] as const

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function registerForStore(shopDomain: string, accessToken: string): Promise<void> {
  console.log(`\n→ ${shopDomain}`)

  for (const topic of COMPLIANCE_TOPICS) {
    try {
      const res = await fetch(`https://${shopDomain}/admin/api/2024-10/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook: { topic, address: WEBHOOK_ADDRESS, format: 'json' } }),
      })

      const body = await res.json() as Record<string, unknown>

      if (res.ok) {
        console.log(`  ✓ ${topic}`)
      } else if (res.status === 422) {
        // Already exists
        console.log(`  ~ ${topic} (already registered)`)
      } else {
        console.error(`  ✗ ${topic} — ${res.status}: ${JSON.stringify(body)}`)
      }
    } catch (err) {
      console.error(`  ✗ ${topic} — ${err instanceof Error ? err.message : err}`)
    }
  }
}

async function main() {
  const admin = createAdminClient()

  const { data: stores, error } = await admin
    .from('shopify_stores')
    .select('shop_domain, access_token')

  if (error) {
    console.error('Failed to fetch stores:', error.message)
    process.exit(1)
  }

  if (!stores || stores.length === 0) {
    console.log('No stores found in shopify_stores table.')
    return
  }

  console.log(`Found ${stores.length} store(s). Registering compliance webhooks...\n`)
  console.log(`Webhook address: ${WEBHOOK_ADDRESS}`)

  for (const store of stores) {
    await registerForStore(
      store.shop_domain as string,
      store.access_token as string,
    )
  }

  console.log('\nDone.')
}

main()
