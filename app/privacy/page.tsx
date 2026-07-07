import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — BedSync',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">BedSync</span>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to home</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective Date: July 7, 2026 · Last Updated: July 7, 2026</p>

        <div className="space-y-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>BedSync ("we," "us," or "our") operates the BedSync web application (the "Service"). This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our Service. By creating an account or using BedSync, you agree to the terms of this Privacy Policy.</p>
            <p className="mt-3">We are based in Idaho, United States. This policy is governed by the laws of the State of Idaho and applicable federal law.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-800 mb-1">a. Information You Provide</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li><strong>Account information:</strong> name, email address, and password when you register</li>
                  <li><strong>Billing information:</strong> processed through Stripe; we do not store your credit card number or payment details directly</li>
                  <li><strong>Shopify store credentials:</strong> your Shopify store domain and access token, used solely to sync prices to your store</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">b. Information Collected Automatically</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li><strong>Usage data:</strong> pages visited, features used, button clicks, and session duration</li>
                  <li><strong>Log data:</strong> IP address, browser type, device type, and timestamps of requests</li>
                  <li><strong>Cookies and local storage:</strong> used to maintain your session and preferences</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">c. Third-Party Data</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li><strong>Manufacturer pricing data:</strong> publicly available pricing information scraped from mattress manufacturer websites on your behalf</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="mb-2">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Provide, operate, and maintain the BedSync Service</li>
              <li>Authenticate your identity and manage your account</li>
              <li>Scrape manufacturer pricing data and sync it to your Shopify store</li>
              <li>Process payments through Stripe</li>
              <li>Send transactional emails (account confirmations, password resets, billing receipts)</li>
              <li>Monitor and analyze usage to improve the Service</li>
              <li>Detect and prevent fraud, abuse, or security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">4. How We Share Your Information</h2>
            <p className="mb-2">We may share your information with:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li><strong>Stripe:</strong> for payment processing. Stripe's privacy policy governs their handling of your data.</li>
              <li><strong>Supabase:</strong> for database storage and authentication infrastructure.</li>
              <li><strong>Vercel:</strong> for hosting and serving the application.</li>
              <li><strong>ScraperAPI:</strong> requests are routed through their proxy network to fetch manufacturer pricing. No personal information is shared with ScraperAPI.</li>
              <li><strong>Legal authorities:</strong> if required by law, court order, or to protect our legal rights.</li>
            </ul>
            <p className="mt-3">We do not share your data with advertisers or for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. If you delete your account, we will delete your personal information within 30 days, except where we are required to retain it for legal or financial compliance purposes (e.g., billing records).</p>
            <p className="mt-3">Price history and sync logs associated with your account are deleted along with your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">6. Data Security</h2>
            <p className="mb-2">We implement industry-standard security measures including:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Encrypted connections (HTTPS/TLS) for all data in transit</li>
              <li>Encrypted storage of sensitive credentials (Shopify access tokens)</li>
              <li>Row-level security on our database to prevent unauthorized data access</li>
              <li>Access controls limiting which personnel can access production data</li>
            </ul>
            <p className="mt-3">No method of transmission over the internet is 100% secure. We cannot guarantee absolute security but take reasonable measures to protect your data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li><strong>Access:</strong> request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> request deletion of your account and associated data</li>
              <li><strong>Data portability:</strong> request an export of your data in a machine-readable format</li>
              <li><strong>Opt-out:</strong> unsubscribe from non-transactional emails at any time</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at the email address below.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>BedSync uses cookies and similar technologies to maintain your login session and remember your preferences. We do not use cookies for advertising or cross-site tracking. You can disable cookies in your browser settings, but doing so may prevent you from using certain features of the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">9. Children's Privacy</h2>
            <p>BedSync is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, contact us and we will delete it.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">10. Third-Party Links</h2>
            <p>The Service may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the "Last Updated" date. Your continued use of the Service after changes are posted constitutes your acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p className="mb-2">If you have questions or concerns about this Privacy Policy, contact us at:</p>
            <p>
              <strong>Email:</strong>{' '}
              <a href="mailto:bedsyncsupport@gmail.com" className="text-blue-600 hover:underline">bedsyncsupport@gmail.com</a><br />
              <strong>Service:</strong> BedSync (bedsync.app)
            </p>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-200">
            This Privacy Policy was last updated on July 7, 2026.
          </p>
        </div>
      </main>
    </div>
  )
}
