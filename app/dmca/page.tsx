import Link from 'next/link'

export const metadata = {
  title: 'DMCA Policy — BedSync',
}

export default function DmcaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">BedSync</span>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to home</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">DMCA Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective Date: July 7, 2026</p>

        <div className="space-y-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Digital Millennium Copyright Act (DMCA) Notice and Takedown Policy</h2>
            <p>BedSync respects the intellectual property rights of others and expects users of our Service to do the same. In accordance with the Digital Millennium Copyright Act of 1998 ("DMCA"), we will respond promptly to claims of copyright infringement committed using BedSync.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">What BedSync Does</h2>
            <p>BedSync accesses publicly available pricing information displayed on third-party mattress manufacturer websites on behalf of our users. We do not store, reproduce, or redistribute copyrighted creative content such as images, product descriptions, or marketing copy. We access only numerical pricing data that is publicly visible on manufacturer websites.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Filing a DMCA Takedown Notice</h2>
            <p className="mb-3">If you believe that content accessible through BedSync infringes your copyright, you may submit a written DMCA notice to us containing the following information:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li><strong>Identification of the copyrighted work</strong> you claim has been infringed</li>
              <li><strong>Identification of the material</strong> you claim is infringing, with enough detail for us to locate it (e.g., the specific URL or product)</li>
              <li><strong>Your contact information:</strong> name, mailing address, telephone number, and email address</li>
              <li><strong>A statement</strong> that you have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law</li>
              <li><strong>A statement</strong> that the information in your notice is accurate and, under penalty of perjury, that you are the copyright owner or authorized to act on the copyright owner's behalf</li>
              <li><strong>Your physical or electronic signature</strong></li>
            </ol>
            <p className="mt-4">Send your DMCA notice to:</p>
            <p className="mt-2 text-gray-800">
              <strong>Email:</strong> niteclanisdabest127@gmail.com<br />
              <strong>Subject line:</strong> DMCA Takedown Notice
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Our Response</h2>
            <p className="mb-2">Upon receiving a valid DMCA notice, we will:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Review the claim promptly</li>
              <li>Remove or disable access to the allegedly infringing material if the claim is valid</li>
              <li>Notify the user whose content or activity is the subject of the notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Counter-Notice</h2>
            <p className="mb-3">If you believe your content was removed in error, you may file a counter-notice with the following information:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Identification of the material that was removed and its location before removal</li>
              <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake or misidentification</li>
              <li>Your name, address, telephone number, and email address</li>
              <li>A statement that you consent to jurisdiction of the federal court in Idaho</li>
              <li>Your physical or electronic signature</li>
            </ol>
            <p className="mt-4">Send counter-notices to the same email address above.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Repeat Infringers</h2>
            <p>BedSync reserves the right to terminate accounts of users who are found to be repeat infringers of intellectual property rights.</p>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-200">
            This DMCA Policy was last updated on July 7, 2026.
          </p>
        </div>
      </main>
    </div>
  )
}
