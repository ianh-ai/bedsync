'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Animated counter ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

// ── Demo player ───────────────────────────────────────────────────────────────

function DemoPlayer() {
  const [step, setStep] = useState(0)
  const STEPS = 5

  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % STEPS), 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-blue-600 transition-all duration-[1900ms] ease-linear"
          style={{ width: `${((step + 1) / STEPS) * 100}%` }}
        />
      </div>

      <div className="px-8 py-8 min-h-[280px] flex flex-col justify-center">
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 1 — Detecting price change</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-gray-500 bg-white rounded px-3 py-0.5 border border-gray-200">
                  helixsleep.com/products/midnight-luxe
                </span>
              </div>
              <div className="p-5 font-mono text-sm space-y-1">
                <p className="text-gray-500">Helix Midnight Luxe · Queen</p>
                <p>Price: <span className="bg-yellow-200 text-yellow-900 px-1.5 py-0.5 rounded font-semibold">$1,999</span></p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 2 — Price change detected</p>
            <div className="border border-orange-200 bg-orange-50 rounded-xl p-5 flex items-start gap-3">
              <span className="relative flex h-3 w-3 mt-0.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
              </span>
              <div>
                <p className="text-sm font-semibold text-orange-900">🔔 Price change detected</p>
                <p className="text-sm text-orange-800 mt-1">
                  Helix Midnight Luxe · Queen<br />
                  <span className="font-mono">$1,899 → $1,999 <span className="text-green-700 font-semibold">(+$100)</span></span>
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 3 — Updating your dashboard</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-900 px-4 py-2.5">
                <span className="text-xs text-gray-400 font-medium">BedSync Dashboard</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-3 font-medium text-gray-900">Helix Midnight Luxe</td>
                    <td className="px-4 py-3 text-gray-600">Queen</td>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700">$1,899 → $1,999</td>
                    <td className="px-4 py-3 text-blue-600 font-medium text-sm">Updating...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 4 — Syncing to store</p>
            <div className="flex items-center justify-center gap-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-green-600">
                    <path d="M15.3 4.8c-.1-.3-.3-.5-.5-.5l-1.8-.1L11.9 3c-.2-.1-.5-.1-.6 0l-.9.3s-.6-.2-1.3-.2c-2.2 0-3.2 1.6-3.5 2.5-.9.3-1.5.5-1.5.5-.4.1-.4.2-.5.5L2.8 19l13.9 2.3V4.8h-1.4zm-3.8-.7-1.4.4c0-.2 0-.4-.1-.6-.1-.7-.5-1.1-.8-1.3.7.1 1.3.8 1.6 1.4l-.3.1zm-1.7.5-1.9.6c.2-.7.6-1.4 1.2-1.6.1.5.4.8.7 1zm-.6-2.1c.1 0 .2 0 .2.1-.4.2-.8.7-1 1.6l-1.3.4c.2-.9.9-2.1 2.1-2.1z"/>
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-600">Shopify</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-500 text-center">Syncing<br />variant prices...</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                    <rect width="24" height="24" rx="4" fill="#7f54b3" />
                    <path d="M3 6.4C3.3 6.1 3.7 6 4.2 6h15.6c.5 0 .9.2 1.1.5.3.3.3.7.2 1.1l-2 9.8c-.1.5-.4.8-.8.8H4.3c-.4 0-.7-.3-.8-.8L2.7 7.5c-.1-.5 0-.8.3-1.1zm3.8 8.9c.4 0 .8-.2 1-.5.2-.2.3-.6.2-1l-.6-3.3h.8L9 13l1-2.9h.8l.3 4.8h-.7l-.2-3.3-1.1 2.5h-.5L7.4 11.6l-.2 3.3H6.8l-.5.4h.5zm7.5 0c-.5 0-.9-.2-1.2-.6-.3-.4-.4-.9-.4-1.4 0-.6.1-1 .4-1.4.3-.4.6-.6 1.1-.6s.8.2 1.1.6c.3.4.4.8.4 1.4 0 .5-.1 1-.4 1.4-.3.4-.6.6-1 .6zm0-.6c.2 0 .4-.1.6-.4.1-.2.2-.6.2-.9 0-.4-.1-.7-.2-1-.2-.2-.4-.3-.6-.3s-.4.1-.6.3c-.1.2-.2.6-.2.9 0 .4.1.7.2.9.2.3.4.5.6.5z" fill="white" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-600">WooCommerce</span>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 5 — Done ✓</p>
            <div className="border border-green-200 bg-green-50 rounded-xl px-5 py-3">
              <p className="text-sm font-semibold text-green-800">✓ Sync complete · 6 variants updated · 0 errors</p>
            </div>
            <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Size</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Before</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">After</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {[['Twin','$1,699','$1,799'],['Twin XL','$1,799','$1,899'],['Full','$1,799','$1,899'],['Queen','$1,899','$1,999'],['King','$2,199','$2,299'],['Cal King','$2,199','$2,299']].map(([sz, b, a]) => (
                  <tr key={sz}>
                    <td className="px-3 py-1.5 text-gray-700">{sz}</td>
                    <td className="px-3 py-1.5 text-gray-400 line-through font-mono">{b}</td>
                    <td className="px-3 py-1.5 text-green-700 font-semibold font-mono">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 pb-5">
        {Array.from({ length: STEPS }).map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'bg-blue-600 w-5' : 'bg-gray-300 w-2'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  { q: 'How does BedSync get manufacturer prices?', a: 'We scrape manufacturer websites daily using a custom scraper built for each brand. Prices are pulled directly from the product pages.' },
  { q: 'Will this work with my existing Shopify products?', a: 'Yes. You just need your existing Shopify Product ID — BedSync handles the rest.' },
  { q: "What if a brand's website changes?", a: 'We monitor our scrapers and update them when brand websites change. Priority is given to Pro and Business plan users.' },
  { q: 'Can I track both sale price and regular price?', a: "Yes. BedSync captures both the regular (compare-at) price and sale price when available, and maps both to your store's variants." },
  { q: 'How do I know when prices change?', a: 'Pro and Business plans receive email alerts whenever a tracked product\'s price changes.' },
  { q: 'Is WooCommerce fully supported?', a: 'Yes. Connect with your Consumer Key and Secret and BedSync syncs prices the same way it does for Shopify.' },
]

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-900 pr-4">{item.q}</span>
            <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === i && (
            <div className="px-5 pb-4">
              <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const BRANDS = ['Helix', 'Bear', 'Avocado', 'Puffy', 'Nectar', 'Casper', 'Brooklyn Bedding', 'Dreamcloud', 'Naturepedic', 'Birch', 'MLily', 'Tempur-Pedic', 'Leesa', 'WinkBeds']

const NAV_LINKS: [string, string][] = [['Features', '#features'], ['How it Works', '#how-it-works'], ['Pricing', '#pricing'], ['FAQ', '#faq']]

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pricingCount, setPricingCount] = useState(1247)

  const productsCount = useCountUp(2400)
  const brandsCount = useCountUp(14)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setPricingCount(c => c + 1), 8000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 35s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.35s ease both; }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient { background-size: 200% auto; animation: gradientShift 4s ease infinite; }
      `}</style>

      <div className="min-h-screen bg-white">

        {/* NAV */}
        <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900">BedSync</span>

            <nav className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(([label, href]) => (
                <a key={label} href={href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">{label}</a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign In</Link>
              <Link href="/signup" className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">Get Started</Link>
            </div>

            <button onClick={() => setMobileOpen(o => !o)} className="md:hidden p-2 text-gray-600 hover:text-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
              {NAV_LINKS.map(([label, href]) => (
                <a key={label} href={href} onClick={() => setMobileOpen(false)} className="block text-sm text-gray-700 py-1">{label}</a>
              ))}
              <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
                <Link href="/login" className="text-sm text-gray-700">Sign In</Link>
                <Link href="/signup" className="text-sm font-semibold bg-blue-600 text-white px-4 py-2.5 rounded-lg text-center">Get Started Free</Link>
              </div>
            </div>
          )}
        </header>

        {/* HERO */}
        <section className="pt-28 pb-20 px-4 sm:px-6 bg-gradient-to-b from-[#F8FAFF] to-white">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Automated mattress price syncing
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-5">
              Keep your prices in sync,{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent animate-gradient">
                automatically
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
              BedSync monitors manufacturer prices daily across 14 brands and syncs them to your Shopify or WooCommerce store — so you never lose a sale to an outdated price.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
              <Link href="/signup" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-blue-100 text-sm">
                Get Started Free
              </Link>
              <a href="#demo" className="w-full sm:w-auto border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold px-7 py-3.5 rounded-xl transition-colors text-center text-sm">
                See how it works
              </a>
            </div>

            {/* Counter row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto mb-16">
              {[
                { value: `${productsCount.toLocaleString()}+`, label: 'Products synced today' },
                { value: String(brandsCount), label: 'Supported brands' },
                { value: '6am', label: 'Daily auto-sync' },
                { value: '< 30s', label: 'Per product sync' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums">{value}</div>
                  <div className="text-xs text-gray-500 mt-1.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Dashboard mockup */}
            <div className="animate-float">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/60 overflow-hidden text-left">
                <div className="bg-gray-900 px-5 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-sm text-gray-400 font-medium">BedSync Dashboard</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Size</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="px-5 py-3.5 font-medium text-gray-900">Helix Midnight Luxe</td>
                        <td className="px-5 py-3.5 text-gray-600">Queen</td>
                        <td className="px-5 py-3.5 font-mono text-gray-900">$1,899 → $1,999</td>
                        <td className="px-5 py-3.5"><span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Synced</span></td>
                      </tr>
                      <tr>
                        <td className="px-5 py-3.5 font-medium text-gray-900">Casper Dream</td>
                        <td className="px-5 py-3.5 text-gray-600">King</td>
                        <td className="px-5 py-3.5 font-mono text-gray-900">$2,295</td>
                        <td className="px-5 py-3.5"><span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Synced</span></td>
                      </tr>
                      <tr className="animate-pulse">
                        <td className="px-5 py-3.5 font-medium text-gray-900">Leesa Legend</td>
                        <td className="px-5 py-3.5 text-gray-600">Queen</td>
                        <td className="px-5 py-3.5 font-mono text-gray-900">$1,699</td>
                        <td className="px-5 py-3.5"><span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">↻ Syncing...</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BRANDS MARQUEE */}
        <section className="py-10 bg-white border-y border-gray-100 overflow-hidden">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">14 brands supported and counting</p>
          <div className="flex">
            <div className="flex gap-3 animate-marquee whitespace-nowrap">
              {[...BRANDS, ...BRANDS].map((brand, i) => (
                <span key={i} className="inline-flex items-center px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm font-medium text-gray-700 shrink-0">
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="py-24 px-4 sm:px-6 bg-gray-950">
          <div className="max-w-5xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Updating prices shouldn&apos;t take hours</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Every week, mattress retailers spend hours doing work that software should be doing.</p>
          </div>
          <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-5">
            {[
              { title: 'Manual updates eat your day', body: 'Checking 10+ manufacturer sites and updating every Shopify variant by hand takes hours every week.' },
              { title: 'Stale prices cost you sales', body: "When a manufacturer runs a sale you don't know about, customers go elsewhere." },
              { title: 'Mistakes happen', body: 'Manual data entry means wrong prices, broken variants, and unhappy customers.' },
            ].map(({ title, body }) => (
              <div key={title} className="bg-gray-900 rounded-xl p-6 border border-gray-800" style={{ borderLeftColor: '#ef4444', borderLeftWidth: '3px' }}>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SOLUTION */}
        <section id="features" className="py-24 px-4 sm:px-6 bg-[#F8FAFF]">
          <div className="max-w-5xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">BedSync does it for you</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Connect your store once. Add your products. BedSync handles the rest — every single day.</p>
          </div>
          <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-5">
            {[
              { icon: '🔗', title: 'Scrapes manufacturer prices daily', body: 'Pulls current sale and regular prices directly from brand websites.' },
              { icon: '📋', title: 'Matches your product variants', body: 'Automatically maps sizes (Twin, Queen, King, etc.) to your store\'s variants.' },
              { icon: '🔄', title: 'Syncs to Shopify or WooCommerce', body: 'Updates your store prices at 6am every morning without you lifting a finger.' },
            ].map(({ icon, title, body }) => (
              <div key={title} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm" style={{ borderLeftColor: '#2563eb', borderLeftWidth: '3px' }}>
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DEMO */}
        <section id="demo" className="py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Watch BedSync work in real time</h2>
            <p className="text-gray-500 max-w-xl mx-auto">This is exactly what happens every morning at 6am for your store.</p>
          </div>
          <DemoPlayer />
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-[#F8FAFF]">
          <div className="max-w-4xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Up and running in 3 steps</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-5">
            {[
              { n: '1', title: 'Connect your store', body: 'Link Shopify via OAuth or enter your WooCommerce API keys. Takes 60 seconds.' },
              { n: '2', title: 'Add your products', body: 'Browse our catalog of 120+ mattress models and enter your store\'s Product ID for each one.' },
              { n: '3', title: 'Let BedSync run', body: 'Prices sync automatically every morning. You get accurate prices without any manual work.' },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-base">
                  {n}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PLATFORMS */}
        <section className="py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Works with your store</h2>
          </div>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-2xl p-10 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg viewBox="0 0 24 24" className="w-10 h-10 fill-green-600">
                  <path d="M15.3 4.8c-.1-.3-.3-.5-.5-.5l-1.8-.1L11.9 3c-.2-.1-.5-.1-.6 0l-.9.3s-.6-.2-1.3-.2c-2.2 0-3.2 1.6-3.5 2.5-.9.3-1.5.5-1.5.5-.4.1-.4.2-.5.5L2.8 19l13.9 2.3V4.8h-1.4zm-3.8-.7-1.4.4c0-.2 0-.4-.1-.6-.1-.7-.5-1.1-.8-1.3.7.1 1.3.8 1.6 1.4l-.3.1zm-1.7.5-1.9.6c.2-.7.6-1.4 1.2-1.6.1.5.4.8.7 1zm-.6-2.1c.1 0 .2 0 .2.1-.4.2-.8.7-1 1.6l-1.3.4c.2-.9.9-2.1 2.1-2.1z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Shopify</h3>
              <p className="text-sm text-gray-500">Connect in one click via OAuth. No API keys needed.</p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-10 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none">
                  <rect width="24" height="24" rx="4" fill="#7f54b3" />
                  <path d="M3 6.4C3.3 6.1 3.7 6 4.2 6h15.6c.5 0 .9.2 1.1.5.3.3.3.7.2 1.1l-2 9.8c-.1.5-.4.8-.8.8H4.3c-.4 0-.7-.3-.8-.8L2.7 7.5c-.1-.5 0-.8.3-1.1zm3.8 8.9c.4 0 .8-.2 1-.5.2-.2.3-.6.2-1l-.6-3.3h.8L9 13l1-2.9h.8l.3 4.8h-.7l-.2-3.3-1.1 2.5h-.5L7.4 11.6l-.2 3.3H6.8zm7.5 0c-.5 0-.9-.2-1.2-.6-.3-.4-.4-.9-.4-1.4 0-.6.1-1 .4-1.4.3-.4.6-.6 1.1-.6s.8.2 1.1.6c.3.4.4.8.4 1.4 0 .5-.1 1-.4 1.4-.3.4-.6.6-1 .6zm0-.6c.2 0 .4-.1.6-.4.1-.2.2-.6.2-.9 0-.4-.1-.7-.2-1-.2-.2-.4-.3-.6-.3s-.4.1-.6.3c-.1.2-.2.6-.2.9 0 .4.1.7.2.9.2.3.4.5.6.5z" fill="white" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">WooCommerce</h3>
              <p className="text-sm text-gray-500">Connect with your Consumer Key and Secret from WooCommerce settings.</p>
            </div>
          </div>
        </section>

        {/* WHY RETAILERS */}
        <section className="py-24 px-4 sm:px-6 bg-[#F8FAFF]">
          <div className="max-w-5xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Why retailers choose BedSync</h2>
          </div>
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-5">
            {[
              { icon: '⏱', stat: '8+ hours saved per week', body: 'Time spent manually checking and updating manufacturer prices.' },
              { icon: '💰', stat: 'Never miss a manufacturer sale', body: 'Always match the sale price the same day it goes live.' },
              { icon: '📊', stat: 'Full price history', body: 'See every price change across all your tracked products.' },
              { icon: '🔄', stat: '14 brands, 120+ models', body: 'The most comprehensive mattress price catalog available.' },
            ].map(({ icon, stat, body }) => (
              <div key={stat} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-3xl mb-3">{icon}</div>
                <div className="text-base font-bold text-gray-900 mb-1">{stat}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* BEFORE vs AFTER */}
        <section className="py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">See the difference</h2>
          </div>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="bg-red-50 p-8 sm:border-r border-b sm:border-b-0 border-gray-200">
              <p className="text-sm font-bold text-red-700 mb-5">✗ Without BedSync</p>
              <ul className="space-y-3">
                {['Check 10+ sites manually', 'Update each variant by hand', 'Miss manufacturer sales', 'Risk pricing errors', 'Spend hours every week'].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-red-700">
                    <span className="text-red-400 shrink-0 mt-0.5">✗</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-green-50 p-8">
              <p className="text-sm font-bold text-green-700 mb-5">✓ With BedSync</p>
              <ul className="space-y-3">
                {['Prices update every morning at 6am', 'All variants synced automatically', 'Manufacturer sales caught instantly', 'Zero manual entry', 'Set it and forget it'].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-green-700">
                    <span className="text-green-500 shrink-0 mt-0.5">✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-24 px-4 sm:px-6 bg-[#F8FAFF]">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">Simple, transparent pricing</h2>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              {pricingCount.toLocaleString()} products synced today
            </div>
          </div>

          <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-5 mb-6">
            {[
              { name: 'Starter', price: '$29', features: ['Up to 25 products', '1 store', 'Daily sync', 'Price history'], popular: false },
              { name: 'Pro', price: '$79', features: ['Up to 100 products', '1 store', 'Daily sync', 'Price history', 'Email alerts on price changes'], popular: true },
              { name: 'Business', price: '$149', features: ['Unlimited products', '1 store', 'Daily sync', 'Price history', 'Email alerts', 'Priority support'], popular: false },
            ].map(({ name, price, features, popular }) => (
              <div key={name} className={`relative rounded-2xl p-6 flex flex-col ${popular ? 'bg-blue-600 shadow-2xl shadow-blue-200' : 'bg-white border border-gray-200 shadow-sm'}`}>
                {popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">Most Popular</span>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className={`text-base font-bold mb-2 ${popular ? 'text-white' : 'text-gray-900'}`}>{name}</h3>
                  <div className="flex items-end gap-1">
                    <span className={`text-4xl font-bold ${popular ? 'text-white' : 'text-gray-900'}`}>{price}</span>
                    <span className={`text-sm mb-1 ${popular ? 'text-blue-200' : 'text-gray-500'}`}>/mo</span>
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {features.map(f => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${popular ? 'text-blue-100' : 'text-gray-600'}`}>
                      <svg className={`w-4 h-4 shrink-0 mt-0.5 ${popular ? 'text-blue-300' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`w-full text-center text-sm font-bold py-3 rounded-xl transition-colors ${popular ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500">All plans include Shopify and WooCommerce support. Cancel anytime.</p>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
          </div>
          <FAQAccordion />
        </section>

        {/* FINAL CTA */}
        <section className="py-28 px-4 sm:px-6 bg-gradient-to-r from-blue-600 to-indigo-700">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Start syncing your prices today</h2>
            <p className="text-blue-100 text-lg mb-8 opacity-90">Join retailers who stopped updating prices manually.</p>
            <Link href="/signup" className="inline-block bg-white text-blue-600 font-bold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg text-sm">
              Get Started Free
            </Link>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-white border-t border-gray-100 py-10 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="text-base font-bold text-gray-900 mb-1">BedSync</div>
              <p className="text-xs text-gray-500">Automated mattress price syncing</p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              {[['Features', '#features'], ['Pricing', '#pricing'], ['FAQ', '#faq'], ['Sign In', '/login']].map(([label, href]) => (
                <a key={label} href={href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">© 2026 BedSync. All rights reserved.</p>
          </div>
        </footer>

      </div>
    </>
  )
}
