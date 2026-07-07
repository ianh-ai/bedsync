import Link from 'next/link'

export const metadata = {
  title: 'Terms and Conditions — BedSync',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">BedSync</span>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to home</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-500 mb-10">Effective Date: July 7, 2026 · Last Updated: July 7, 2026</p>

        <div className="space-y-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">1. Agreement to Terms</h2>
            <p>By creating an account or using BedSync ("Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree, do not create an account or use the Service.</p>
            <p className="mt-3">These Terms are governed by the laws of the State of Idaho, United States. Any disputes arising from these Terms or your use of the Service shall be resolved in the courts of Idaho.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>BedSync is a web-based software-as-a-service (SaaS) application that allows mattress retailers to monitor manufacturer pricing from public websites and automatically sync those prices to their Shopify stores. The Service includes automated price scraping, price history tracking, and Shopify integration.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">3. Eligibility</h2>
            <p>You must be at least 18 years old and have the legal authority to enter into a binding agreement to use BedSync. By creating an account, you represent that you meet these requirements.</p>
            <p className="mt-3">BedSync is intended for business use by mattress retailers. Use of the Service for personal, non-commercial purposes is not permitted.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">4. Account Registration</h2>
            <p className="mb-2">You are responsible for:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Providing accurate and complete registration information</li>
              <li>Keeping your password confidential</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
            </ul>
            <p className="mt-3">We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">5. Subscription and Payment</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-800 mb-1">a. Plans</h3>
                <p>BedSync offers subscription plans with different features and brand limits. Current plan details and pricing are available on our website.</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">b. Billing</h3>
                <p>Subscriptions are billed in advance on a monthly basis. Payment is processed through Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis.</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">c. Free Trial</h3>
                <p>If a free tier or trial is offered, you may use it subject to any applicable restrictions. We reserve the right to modify or discontinue free access at any time.</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">d. Cancellation</h3>
                <p>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of your current billing period. We do not provide refunds for partial billing periods.</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">e. Price Changes</h3>
                <p>We reserve the right to change subscription pricing. We will provide at least 30 days' notice before any price increase takes effect for existing subscribers.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to reverse engineer, decompile, or extract the source code of the Service</li>
              <li>Use the Service to scrape websites in violation of those websites' terms of service (you are responsible for ensuring your use complies with applicable third-party terms)</li>
              <li>Resell, sublicense, or otherwise transfer access to the Service to third parties without our written consent</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
              <li>Use the Service to transmit malware, spam, or harmful content</li>
              <li>Overload or disrupt the Service through excessive automated requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">7. Price Scraping and Third-Party Websites</h2>
            <p className="mb-2">BedSync scrapes publicly available pricing data from third-party manufacturer websites on your behalf. You acknowledge that:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>We do not guarantee the accuracy, completeness, or timeliness of scraped pricing data</li>
              <li>Third-party websites may change their structure or block scraping at any time, which may cause temporary or permanent disruption to scraping for specific brands</li>
              <li>You are responsible for verifying that prices synced to your Shopify store are accurate before they are shown to customers</li>
              <li>We are not responsible for pricing errors, lost sales, or compliance issues arising from incorrect or delayed price data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">8. Shopify Integration</h2>
            <p>By connecting your Shopify store to BedSync, you authorize us to read product data and update pricing on your behalf. You remain solely responsible for your Shopify store, its content, and compliance with Shopify's terms of service. We are not affiliated with or endorsed by Shopify Inc.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">9. Intellectual Property</h2>
            <p>All content, features, and functionality of BedSync — including the software, design, text, and graphics — are owned by BedSync and protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Service for its intended purpose during your active subscription.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">10. Confidentiality</h2>
            <p>Any non-public information you share with us in connection with the Service will be treated as confidential and will not be disclosed to third parties except as described in our Privacy Policy.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">11. Disclaimers</h2>
            <p className="uppercase text-xs tracking-wide text-gray-600 leading-relaxed">
              The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
            </p>
            <p className="uppercase text-xs tracking-wide text-gray-600 leading-relaxed mt-3">
              We do not warrant that: the Service will be uninterrupted or error-free; pricing data scraped from third-party sites will be accurate or current; the Service will meet your specific business requirements.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">12. Limitation of Liability</h2>
            <p className="uppercase text-xs tracking-wide text-gray-600 leading-relaxed">
              To the maximum extent permitted by applicable law, BedSync shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, lost revenue, lost data, or business interruption, arising from your use of or inability to use the Service.
            </p>
            <p className="uppercase text-xs tracking-wide text-gray-600 leading-relaxed mt-3">
              Our total liability for any claim arising from these Terms or your use of the Service shall not exceed the amount you paid to us in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">13. Indemnification</h2>
            <p className="mb-2">You agree to indemnify and hold BedSync harmless from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Your use of the Service in violation of these Terms</li>
              <li>Your violation of any third party's rights, including Shopify's terms of service or manufacturer website terms</li>
              <li>Any pricing errors displayed to your customers resulting from data provided by the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">14. Termination</h2>
            <p>We reserve the right to suspend or terminate your account and access to the Service at any time, with or without notice, if we determine that you have violated these Terms or that continued access poses a risk to the Service or other users.</p>
            <p className="mt-3">You may terminate your account at any time by cancelling your subscription and contacting us to delete your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">15. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes by email or by posting a notice within the Service. Your continued use of the Service after changes are posted constitutes your acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">16. Governing Law and Disputes</h2>
            <p>These Terms are governed by the laws of the State of Idaho, without regard to its conflict of law provisions. Any dispute arising from these Terms shall be resolved through binding arbitration in Idaho, except that either party may seek injunctive or equitable relief in a court of competent jurisdiction.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">17. Entire Agreement</h2>
            <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and BedSync regarding your use of the Service and supersede any prior agreements.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">18. Contact Us</h2>
            <p className="mb-2">If you have questions about these Terms, contact us at:</p>
            <p>
              <strong>Email:</strong>{' '}
              <a href="mailto:bedsyncsupport@gmail.com" className="text-blue-600 hover:underline">bedsyncsupport@gmail.com</a><br />
              <strong>Service:</strong> BedSync (bedsync.app)
            </p>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-200">
            These Terms and Conditions were last updated on July 7, 2026.
          </p>
        </div>
      </main>
    </div>
  )
}
