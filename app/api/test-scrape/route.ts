// Playwright can't run on Vercel serverless (crashes with "Cannot find module
// browsers.json") — same issue as /api/scrape. This route backs the local dev
// tool at app/dashboard/test (manual per-brand scraper testing) and has no
// other caller. Disabled here rather than deleted since the dev tool still
// links to it; stubbing the handler removes the static lib/scrapers.ts
// (and therefore playwright) import that was crashing Vercel on every hit.
export async function POST() {
  return Response.json(
    { success: false, error: 'Manual scraping is not available on this deployment — prices are updated automatically each morning.' },
    { status: 503 }
  )
}
