import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">BedSync</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        <section className="py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            Automated mattress price syncing
          </div>
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight mb-6">
            Keep your prices in sync,{' '}
            <span className="text-blue-600">automatically</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            Connect your Shopify store, link your products to manufacturer pages, and BedSync
            scrapes current prices daily — keeping you competitive without the manual work.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 font-medium px-6 py-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="py-16 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Connect your store</h3>
              <p className="text-sm text-gray-500">
                Link your Shopify store in seconds. BedSync handles the rest using your existing product catalog.
              </p>
            </div>

            <div className="p-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Track manufacturer prices</h3>
              <p className="text-sm text-gray-500">
                Map your products to manufacturer URLs across Helix, Casper, Purple, and 10+ more brands.
              </p>
            </div>

            <div className="p-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Auto-sync daily</h3>
              <p className="text-sm text-gray-500">
                Prices update automatically every day. Match sale price, regular price, or add a custom markup.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Supported brands</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['Helix Sleep', 'Dreamcloud', 'Bear', 'Casper', 'Nectar', 'Puffy', 'Brooklyn Bedding', 'Birch', 'Avocado', 'Mlily', 'Naturepedic', 'WinkBeds'].map(brand => (
              <span key={brand} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-700">
                {brand}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} BedSync. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
