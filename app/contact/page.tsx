import Link from 'next/link'

export const metadata = {
  title: 'Contact Support — BedSync',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">BedSync</span>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to home</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Contact Support</h1>
        <p className="text-sm text-gray-600 mb-8">Have a question or need help? We&apos;re here for you.</p>

        <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
            <a
              href="mailto:bedsyncsupport@gmail.com"
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              bedsyncsupport@gmail.com
            </a>
          </div>
          <div>
            <p className="text-sm text-gray-500">We typically respond within 1–2 business days.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
