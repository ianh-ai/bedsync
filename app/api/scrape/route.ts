// Playwright can't run on Vercel serverless (crashes with "Cannot find module
// browsers.json") — scraping happens separately via GitHub Actions
// (scripts/daily-scrape.ts), which imports scrapeForBrand from lib/scrapers
// directly and writes to brand_prices itself. This route previously kept a
// runScrape() function around for that script to import, but daily-scrape.ts
// never actually imported it — it always called lib/scrapers directly. That
// unused function still statically imported lib/scrapers.ts (which imports
// playwright at module scope), so merely disabling this handler's body wasn't
// enough: Vercel still crashed trying to load the module graph for this route
// on every request. Removing the dead code removes the import entirely.
export async function POST() {
  return Response.json(
    { error: 'Manual scraping is not available — prices are updated automatically each morning.' },
    { status: 503 }
  )
}
