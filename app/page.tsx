'use client'

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? '',
  pro:     process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '',
  business: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? '',
}

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

      {/* Fixed-height stage — all steps rendered simultaneously, faded in/out */}
      <div className="relative h-[360px] overflow-hidden">

        {/* Step 0 */}
        <div className={`absolute inset-0 px-8 py-8 flex flex-col justify-center transition-opacity duration-300 ${step === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="space-y-4">
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
        </div>

        {/* Step 1 */}
        <div className={`absolute inset-0 px-8 py-8 flex flex-col justify-center transition-opacity duration-300 ${step === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="space-y-4">
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
        </div>

        {/* Step 2 */}
        <div className={`absolute inset-0 px-8 py-8 flex flex-col justify-center transition-opacity duration-300 ${step === 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="space-y-4">
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
        </div>

        {/* Step 3 */}
        <div className={`absolute inset-0 px-8 py-8 flex flex-col justify-center transition-opacity duration-300 ${step === 3 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="space-y-5">
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
                    <path d="M3 6.4C3.3 6.1 3.7 6 4.2 6h15.6c.5 0 .9.2 1.1.5.3.3.3.7.2 1.1l-2 9.8c-.1.5-.4.8-.8.8H4.3c-.4 0-.7-.3-.8-.8L2.7 7.5c-.1-.5 0-.8.3-1.1zm3.8 8.9c.4 0 .8-.2 1-.5.2-.2.3-.6.2-1l-.6-3.3h.8L9 13l1-2.9h.8l.3 4.8h-.7l-.2-3.3-1.1 2.5h-.5L7.4 11.6l-.2 3.3H6.8zm7.5 0c-.5 0-.9-.2-1.2-.6-.3-.4-.4-.9-.4-1.4 0-.6.1-1 .4-1.4.3-.4.6-.6 1.1-.6s.8.2 1.1.6c.3.4.4.8.4 1.4 0 .5-.1 1-.4 1.4-.3.4-.6.6-1 .6zm0-.6c.2 0 .4-.1.6-.4.1-.2.2-.6.2-.9 0-.4-.1-.7-.2-1-.2-.2-.4-.3-.6-.3s-.4.1-.6.3c-.1.2-.2.6-.2.9 0 .4.1.7.2.9.2.3.4.5.6.5z" fill="white" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-600">WooCommerce</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className={`absolute inset-0 px-8 py-8 flex flex-col justify-center transition-opacity duration-300 ${step === 4 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="space-y-4">
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
        </div>

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
  { q: 'What is BedSync?', a: 'BedSync automatically monitors mattress manufacturer websites for price changes and updates your online store, helping you keep pricing accurate without manual work.' },
  { q: 'Who is BedSync for?', a: 'BedSync is built for mattress retailers, furniture stores, and eCommerce businesses that sell mattresses from brands like Helix, Brooklyn Bedding, Bear, Birch, and more.' },
  { q: 'How does BedSync work?', a: 'Simply connect your store, add the products you want to track, and BedSync continuously monitors manufacturer pricing. When prices change, BedSync updates your store automatically or lets you review the changes first.' },
  { q: 'How often does BedSync check for price changes?', a: 'You can choose automatic syncing on a schedule — daily, weekly, monthly — or manually trigger a sync whenever you want.' },
  { q: 'Which eCommerce platforms are supported?', a: 'BedSync supports Shopify and WooCommerce, with additional platform support planned for the future.' },
  { q: 'Can I track hundreds of mattresses?', a: 'Absolutely. BedSync is designed to handle large catalogs with bulk product management and bulk syncing.' },
  { q: 'Can I export my pricing?', a: 'Yes. You can export pricing as a CSV, making it easy to create price sheets, signage, or marketing materials.' },
  { q: 'Can I see what changed?', a: 'Yes. Every sync includes before-and-after pricing, timestamps, and a complete history of all detected changes.' },
  { q: 'Is there a history of previous prices?', a: 'Yes. BedSync stores historical pricing so you can review trends and verify when changes occurred.' },
  { q: 'Do you offer onboarding?', a: 'Yes. Every account includes a guided onboarding experience to help you get your first products syncing quickly.' },
  { q: 'Can you add a brand I don\'t see listed?', a: 'Absolutely — we\'re always expanding our brand catalog. Reach out to us at bedsyncsupport@gmail.com with the brand name and website and we\'ll get it added as soon as possible.' },
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

// ── Brand logo ────────────────────────────────────────────────────────────────

function BrandLogo({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="shrink-0 bg-white rounded-lg shadow-sm flex items-center justify-center" style={{ padding: 12 }}>
      <div style={{ position: 'relative', width: 110, height: 40 }}>
        <Image src={logo} alt={name} fill sizes="160px" style={{ objectFit: 'contain' }} />
      </div>
    </div>
  )
}

// ── Pricing cards (checkout-aware) ────────────────────────────────────────────

const PLANS = [
  { slug: 'starter', name: 'Starter', price: '$49', features: ['2 brands', 'Daily sync', 'Price history'], popular: false },
  { slug: 'pro',     name: 'Pro',     price: '$99', features: ['5 brands', 'Daily sync', 'Price history'], popular: true },
  { slug: 'business',name: 'Business',price: '$149',features: ['Unlimited brands', 'Daily sync', 'Price history', 'Priority support'], popular: false },
] as const

function PricingCards({ message }: { message?: string | null }) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = useCallback(async (slug: string) => {
    setLoading(slug)
    const priceId = PLAN_PRICE_IDS[slug]
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      window.location.href = `/login?plan=${slug}`
      return
    }

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const text = await res.text()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = {}
    try { json = JSON.parse(text) } catch { /* non-JSON body — error shown via alert below */ }
    if (json.url) window.location.href = json.url
    else {
      setLoading(null)
      alert(json.error ?? 'Something went wrong. Please try again.')
    }
  }, [])

  return (
    <>
    {message && (
      <div className="max-w-5xl mx-auto mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-amber-800">{message}</p>
      </div>
    )}
    <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-5 mb-6">
      {PLANS.map(({ slug, name, price, features, popular }) => (
        <div key={slug} className={`relative rounded-2xl p-6 flex flex-col ${popular ? 'bg-blue-600 shadow-2xl shadow-blue-200' : 'bg-white border border-gray-200 shadow-sm'}`}>
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
          <button
            onClick={() => handleCheckout(slug)}
            disabled={loading === slug}
            className={`w-full text-center text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-70 ${popular ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {loading === slug ? 'Loading…' : 'Get Started'}
          </button>
        </div>
      ))}
    </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const BRAND_LOGOS = [
  { name: 'Avocado', logo: '/logos/avocado.png' },
  { name: 'Bear', logo: '/logos/bear.png' },
  { name: 'Birch', logo: '/logos/birch.png' },
  { name: 'Brooklyn Bedding', logo: '/logos/brooklyn-bedding.png' },
  { name: 'Casper', logo: '/logos/casper.png' },
  { name: 'DreamCloud', logo: '/logos/dreamcloud.png' },
  { name: 'Helix', logo: '/logos/helix.png' },
  { name: 'Leesa', logo: '/logos/leesa.png' },
  { name: 'Mlily', logo: '/logos/mlily.png' },
  { name: 'Naturepedic', logo: '/logos/naturepedic.png' },
  { name: 'Nectar', logo: '/logos/nectar.png' },
  { name: 'Plank', logo: '/logos/plank.png' },
  { name: 'Puffy', logo: '/logos/puffy.png' },
  { name: 'Tempur-Pedic', logo: '/logos/tempur-pedic.png' },
  { name: 'WinkBeds', logo: '/logos/winkbeds.png' },
]

const NAV_LINKS: [string, string][] = [['Features', '#features'], ['How it Works', '#how-it-works'], ['Featured Brands', '#featured-brands'], ['Pricing', '#pricing'], ['FAQ', '#faq']]

function HomeContent() {
  const searchParams = useSearchParams()
  const pricingMessage = searchParams.get('message')

  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pricingCount, setPricingCount] = useState(1247)
  const [ctaLoading, setCtaLoading] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null) // null = not yet checked
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthEmail(session?.user?.email ?? '')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthEmail(session?.user?.email ?? '')
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // onAuthStateChange will set authEmail to ''
  }, [])

  const handleBillingPortal = useCallback(async () => {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const json = await res.json()
    if (json.url) window.location.href = json.url
    else setPortalLoading(false)
  }, [])

  const handleStarterCheckout = useCallback(async () => {
    setCtaLoading(true)
    const priceId = PLAN_PRICE_IDS['starter']
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login?plan=starter'; return }
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const text = await res.text()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = {}
    try { json = JSON.parse(text) } catch { /* non-JSON body — error shown via alert below */ }
    if (json.url) window.location.href = json.url
    else {
      setCtaLoading(false)
      alert(json.error ?? 'Something went wrong. Please try again.')
    }
  }, [])

  const productsCount = useCountUp(2400)
  const brandsCount = useCountUp(15)

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
        .animate-marquee { animation: marquee 40s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.35s ease both; }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient { background-size: 200% auto; animation: gradientShift 4s ease infinite; }
        .brand-logo { filter: grayscale(100%) opacity(0.55); transition: filter 0.25s ease; }
        .brand-logo:hover { filter: grayscale(0%) opacity(1); }
        .feature-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.09); }
      `}</style>

      <div className="min-h-screen bg-white">

        {/* NAV */}
        <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Image src="/images/wordmark.png" alt="BedSync" height={32} width={120} />

            <nav className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(([label, href]) => (
                <a key={label} href={href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">{label}</a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {authEmail === null ? null : authEmail ? (
                <>
                  <span className="text-sm text-gray-500 max-w-[180px] truncate">{authEmail}</span>
                  <Link href="/dashboard" className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">Go to Dashboard</Link>
                  <button onClick={handleSignOut} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign Out</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign In</Link>
                  <a href="#pricing" className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">Get Started</a>
                </>
              )}
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
                {authEmail ? (
                  <>
                    <span className="text-sm text-gray-500 truncate">{authEmail}</span>
                    <button onClick={handleSignOut} className="text-sm text-gray-700 text-left">Sign Out</button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="text-sm text-gray-700">Sign In</Link>
                    <a href="#pricing" onClick={() => setMobileOpen(false)} className="text-sm font-semibold bg-blue-600 text-white px-4 py-2.5 rounded-lg text-center">Get Started</a>
                  </>
                )}
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
              BedSync monitors manufacturer prices daily across 15 brands and syncs them to your Shopify or WooCommerce store — so you never lose a sale to an outdated price.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
              <a href="#pricing" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-blue-100 text-sm text-center">
                Get Started
              </a>
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
        <section className="py-10 bg-gray-50 border-y border-gray-100 overflow-hidden">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">15 brands monitored and counting</p>
          <div className="flex">
            <div className="flex items-center gap-6 animate-marquee" style={{ whiteSpace: 'nowrap' }}>
              {[...BRAND_LOGOS, ...BRAND_LOGOS].map((brand, i) => (
                <BrandLogo key={i} name={brand.name} logo={brand.logo} />
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

        {/* FEATURES */}
        <section id="features" className="py-24 px-4 sm:px-6 bg-[#F8FAFF]">
          <div className="max-w-5xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">BedSync does it for you</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Connect your store once. Add your products. BedSync handles the rest — every single day.</p>
          </div>
          <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-5">
            {([
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ),
                title: 'Automatic Price Sync',
                body: 'Prices update every morning at 6am — no manual work required.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Bulk Sync',
                body: 'Sync all your tracked products at once with a single click.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ),
                title: 'Price History',
                body: 'Track every price change across all products with detailed charts.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                ),
                title: 'Sync Logs',
                body: 'Review a detailed log of every sync event and price update.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                ),
                title: 'Shopify Integration',
                body: 'Connect in one click via OAuth and update all your Shopify variants automatically.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: 'WooCommerce Integration',
                body: 'Connect with your Consumer Key and Secret — full WooCommerce support.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Price Guardrails',
                body: 'Set min and max price limits — syncs are skipped when prices fall outside range.',
              },
              {
                icon: <TrendingUp className="w-5 h-5" />,
                title: 'Markup Rules',
                body: 'Add a fixed or percentage markup above manufacturer prices — applied automatically on every sync.',
              },
            ] as { icon: React.ReactNode; title: string; body: string }[]).map(({ icon, title, body }) => (
              <div key={title} className="feature-card bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                  {icon}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
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
              { icon: '🔄', stat: '15 brands, 120+ models', body: 'The most comprehensive mattress price catalog available.' },
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

        {/* FEATURED BRANDS */}
        <section id="featured-brands" className="py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Brands We Monitor</h2>
            <p className="text-gray-500">15 major mattress brands and growing.</p>
          </div>
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {BRAND_LOGOS.map(({ name, logo }) => (
              <div key={name} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
                <div style={{ position: 'relative', width: '100%', height: 48 }}>
                  <Image src={logo} alt={name} fill sizes="160px" style={{ objectFit: 'contain' }} />
                </div>
                <span className="text-xs font-semibold text-gray-600 text-center">{name}</span>
              </div>
            ))}
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
              {pricingCount.toLocaleString()} variants synced today
            </div>
          </div>

          <PricingCards message={pricingMessage} />
          <p className="text-center text-sm text-gray-500">All plans include Shopify and WooCommerce support. Cancel anytime.</p>
          {authEmail && (
            <div className="text-center mt-5 space-y-2">
              <p className="text-sm text-gray-500">
                Already subscribed?{' '}
                <button
                  onClick={handleBillingPortal}
                  disabled={portalLoading}
                  className="text-blue-600 hover:underline font-medium disabled:opacity-50"
                >
                  {portalLoading ? 'Loading…' : 'Manage your subscription →'}
                </button>
              </p>
              <p className="text-xs text-gray-400">
                Signed in as {authEmail}.{' '}
                <button onClick={handleSignOut} className="hover:underline">Sign out</button>
              </p>
            </div>
          )}
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
            <button
              onClick={handleStarterCheckout}
              disabled={ctaLoading}
              className="inline-block bg-white text-blue-600 font-bold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg text-sm disabled:opacity-70"
            >
              {ctaLoading ? 'Loading…' : 'Get Started'}
            </button>
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
          <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">© 2026 BedSync. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</a>
              <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</a>
              <a href="/dmca" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">DMCA</a>
              <a href="/contact" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Contact</a>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <HomeContent />
    </Suspense>
  )
}
