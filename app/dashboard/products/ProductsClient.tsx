'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, BarChart2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PriceChart from '../history/[id]/PriceChart'

type Product = {
  id: string
  label: string | null
  shopify_product_title: string | null
  brand: string | null
  shopify_product_id: string | null
  price_rule: string | null
  price_mode: string | null
  markup_value: number | null
  markup_type: string | null
  guardrail_min: number | null
  guardrail_max: number | null
  guardrails: Record<string, { floor?: number; ceiling?: number }> | null
  last_synced_at: string | null
  queen_sale_price: number | null
}

type SyncStatus = 'idle' | 'checking' | 'done' | 'error'
type SyncAllStatus = 'idle' | 'running' | 'done' | 'error'

const PRODUCT_COOLDOWN_MS = 8 * 60 * 60 * 1000   // 8 hours
const SYNC_ALL_COOLDOWN_MS = 24 * 60 * 60 * 1000  // 24 hours

function getNextSyncTime(lastSyncedAt: string | null, cooldownMs: number): Date | null {
  if (!lastSyncedAt) return null
  const nextAt = new Date(new Date(lastSyncedAt).getTime() + cooldownMs)
  return nextAt > new Date() ? nextAt : null
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtRemaining(nextAt: Date): string {
  const totalMins = Math.ceil((nextAt.getTime() - Date.now()) / 60000)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m remaining`
  if (hrs > 0) return `${hrs}h remaining`
  return `${mins}m remaining`
}
type ChartPoint = { time: string; [size: string]: string | number }

type EditForm = {
  label: string
  shopifyProductId: string
  priceMode: string
  markupType: string
  markupValue: string
  guardrailMin: string
  guardrailMax: string
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function ProductsClient({
  initialProducts,
  storePlatform,
  overLimit = false,
  syncAllLastRunAt = null,
}: {
  initialProducts: Product[]
  storePlatform: string | null
  overLimit?: boolean
  syncAllLastRunAt?: string | null
}) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [activeBrand, setActiveBrand] = useState<string | null>(null)
  const [syncStates, setSyncStates] = useState<Record<string, SyncStatus>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [statsId, setStatsId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // Stats state
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsChartData, setStatsChartData] = useState<ChartPoint[]>([])
  const [statsSizes, setStatsSizes] = useState<string[]>([])

  // Edit state
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [syncAllStatus, setSyncAllStatus] = useState<SyncAllStatus>('idle')
  const [syncAllLastRun, setSyncAllLastRun] = useState<string | null>(syncAllLastRunAt)
  const [cooldownToast, setCooldownToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const router = useRouter()
  const anyChecked = selectedIds.size > 0

  const syncAllCooldownUntil = useMemo(
    () => getNextSyncTime(syncAllLastRun, SYNC_ALL_COOLDOWN_MS),
    [syncAllLastRun]
  )

  function showCooldownToast(nextAt: Date) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setCooldownToast(`Next sync available at ${fmtTime(nextAt)} · ${fmtRemaining(nextAt)}`)
    toastTimerRef.current = setTimeout(() => setCooldownToast(null), 5000)
  }

  // Load price history when stats modal opens
  useEffect(() => {
    if (!statsId) return
    setStatsLoading(true)
    setStatsChartData([])
    setStatsSizes([])

    const supabase = createClient()
    supabase
      .from('price_history')
      .select('size, sale_price, recorded_at')
      .eq('product_id', statsId)
      .order('recorded_at', { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (!data || data.length === 0) { setStatsLoading(false); return }
        const rows = data as Array<{ size: string; sale_price: number; recorded_at: string }>
        const sizes = [...new Set(rows.map(r => r.size))]
        const timeMap = new Map<string, Record<string, number>>()
        for (const row of rows) {
          if (!timeMap.has(row.recorded_at)) timeMap.set(row.recorded_at, {})
          timeMap.get(row.recorded_at)![row.size] = row.sale_price
        }
        setStatsSizes(sizes)
        setStatsChartData([...timeMap.entries()].map(([time, vals]) => ({ time, ...vals })))
        setStatsLoading(false)
      })
  }, [statsId])

  const brands = useMemo(
    () => [...new Set(products.map(p => p.brand ?? 'Other'))].sort(),
    [products]
  )

  const filtered = useMemo(() => {
    let result = products
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        (p.label ?? p.shopify_product_title ?? '').toLowerCase().includes(q)
      )
    }
    if (activeBrand !== null) {
      result = result.filter(p => (p.brand ?? 'Other') === activeBrand)
    }
    return result
  }, [products, search, activeBrand])

  const grouped = useMemo(() => {
    const byBrand = new Map<string, Product[]>()
    for (const p of filtered) {
      const b = p.brand ?? 'Other'
      if (!byBrand.has(b)) byBrand.set(b, [])
      byBrand.get(b)!.push(p)
    }
    for (const ps of byBrand.values()) {
      ps.sort((a, b) =>
        (a.label ?? a.shopify_product_title ?? '').localeCompare(b.label ?? b.shopify_product_title ?? '')
      )
    }
    return [...byBrand.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // Keep select-all checkbox indeterminate state in sync
  useEffect(() => {
    if (!selectAllRef.current) return
    const filteredIds = filtered.map(p => p.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))
    const someSelected = filteredIds.some(id => selectedIds.has(id))
    selectAllRef.current.indeterminate = someSelected && !allSelected
  }, [selectedIds, filtered])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    const filteredIds = filtered.map(p => p.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        filteredIds.forEach(id => next.delete(id))
      } else {
        filteredIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  async function handleSync(id: string) {
    setSyncStates(s => ({ ...s, [id]: 'checking' }))
    try {
      const syncRes = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked_product_id: id }),
      })
      if (!syncRes.ok) {
        setSyncStates(s => ({ ...s, [id]: 'error' }))
        setTimeout(() => setSyncStates(s => ({ ...s, [id]: 'idle' })), 3000)
        return
      }
      setProducts(ps => ps.map(p => p.id === id ? { ...p, last_synced_at: new Date().toISOString() } : p))
      setSyncStates(s => ({ ...s, [id]: 'done' }))
      setTimeout(() => setSyncStates(s => ({ ...s, [id]: 'idle' })), 3000)
    } catch {
      setSyncStates(s => ({ ...s, [id]: 'error' }))
      setTimeout(() => setSyncStates(s => ({ ...s, [id]: 'idle' })), 3000)
    }
  }

  async function handleSyncAll() {
    if (syncAllCooldownUntil || syncAllStatus === 'running') return
    setSyncAllStatus('running')
    try {
      const res = await fetch('/api/sync-all', { method: 'POST' })
      const body = await res.json().catch(() => ({})) as { next_sync_at?: string }
      if (res.ok) {
        const now = new Date().toISOString()
        setSyncAllLastRun(now)
        setProducts(ps => ps.map(p => ({ ...p, last_synced_at: now })))
        setSyncAllStatus('done')
        setTimeout(() => setSyncAllStatus('idle'), 3000)
        router.refresh()
      } else if (res.status === 429 && body.next_sync_at) {
        // Already in cooldown on the server — compute last run from next_sync_at
        setSyncAllLastRun(new Date(new Date(body.next_sync_at).getTime() - SYNC_ALL_COOLDOWN_MS).toISOString())
        setSyncAllStatus('idle')
      } else {
        setSyncAllStatus('error')
        setTimeout(() => setSyncAllStatus('idle'), 3000)
      }
    } catch {
      setSyncAllStatus('error')
      setTimeout(() => setSyncAllStatus('idle'), 3000)
    }
  }

  function openEdit(product: Product) {
    setEditForm({
      label: product.label ?? '',
      shopifyProductId: product.shopify_product_id ?? '',
      priceMode: product.price_mode ?? (product.price_rule === 'markup' ? 'markup' : 'match'),
      markupType: product.markup_type ?? 'percentage',
      markupValue: product.markup_value ? String(product.markup_value) : '',
      guardrailMin: product.guardrail_min != null ? String(product.guardrail_min) : '',
      guardrailMax: product.guardrail_max != null ? String(product.guardrail_max) : '',
    })
    setEditId(product.id)
    setEditError(null)
  }

  async function handleEditSave() {
    if (!editId || !editForm) return
    setEditSaving(true)
    setEditError(null)

    const res = await fetch(`/api/products/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: editForm.label.trim() || null,
        shopify_product_id: editForm.shopifyProductId.trim(),
        price_mode: editForm.priceMode,
        markup_type: editForm.priceMode === 'markup' ? editForm.markupType : null,
        markup_value: editForm.priceMode === 'markup' && editForm.markupValue ? parseFloat(editForm.markupValue) : null,
        guardrail_min: editForm.guardrailMin ? parseFloat(editForm.guardrailMin) : null,
        guardrail_max: editForm.guardrailMax ? parseFloat(editForm.guardrailMax) : null,
      }),
    })

    setEditSaving(false)
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setEditError(data.error ?? 'Save failed')
      return
    }

    setProducts(ps => ps.map(p => p.id !== editId ? p : {
      ...p,
      label: editForm.label.trim() || null,
      shopify_product_id: editForm.shopifyProductId.trim(),
      price_mode: editForm.priceMode,
      markup_type: editForm.priceMode === 'markup' ? editForm.markupType : null,
      markup_value: editForm.priceMode === 'markup' && editForm.markupValue ? parseFloat(editForm.markupValue) : null,
      guardrail_min: editForm.guardrailMin ? parseFloat(editForm.guardrailMin) : null,
      guardrail_max: editForm.guardrailMax ? parseFloat(editForm.guardrailMax) : null,
    }))
    setEditId(null)
    setEditForm(null)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) return
    setProducts(ps => ps.filter(p => p.id !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    setDeleteId(null)
    if (editId === id) setEditId(null)
    router.refresh()
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = [...selectedIds]
    await Promise.all(ids.map(id => fetch(`/api/products/${id}`, { method: 'DELETE' })))
    setProducts(ps => ps.filter(p => !ids.includes(p.id)))
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
    setBulkDeleting(false)
    router.refresh()
  }

  const editProduct = editId ? products.find(p => p.id === editId) : null
  const statsProduct = statsId ? products.find(p => p.id === statsId) : null

  return (
    <>
      {/* Search + Brand filter + Sync All */}
      <div className="flex items-start justify-between" style={{marginBottom: 12}}>
      <div style={{flex: 1}}>
        <div className="relative" style={{maxWidth: 240, marginBottom: 8}}>
          <svg
            className="absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            style={{left: 9, width: 13, height: 13}}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            style={{fontSize: 12, padding: '5px 10px 5px 28px'}}
          />
        </div>
        {brands.length > 1 && (
          <div className="flex flex-wrap" style={{gap: 6}}>
            <button
              onClick={() => setActiveBrand(null)}
              className={activeBrand === null
                ? 'rounded-full font-medium transition-colors bg-blue-600 text-white'
                : 'rounded-full font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
              style={{fontSize: 11, padding: '2px 10px'}}
            >
              All
            </button>
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => setActiveBrand(activeBrand === brand ? null : brand)}
                className={activeBrand === brand
                  ? 'rounded-full font-medium capitalize transition-colors bg-blue-600 text-white'
                  : 'rounded-full font-medium capitalize transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
                style={{fontSize: 11, padding: '2px 10px'}}
              >
                {brand}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{paddingLeft: 12, paddingTop: 1}}>
        <button
          onClick={() => syncAllCooldownUntil ? showCooldownToast(syncAllCooldownUntil) : handleSyncAll()}
          disabled={syncAllStatus === 'running' || overLimit}
          title={overLimit ? 'Remove brands to sync' : 'Sync all products'}
          className={
            syncAllStatus === 'done'
              ? 'inline-flex items-center font-medium rounded-md border transition-colors bg-green-50 text-green-700 border-green-200 disabled:opacity-50'
              : syncAllStatus === 'error'
              ? 'inline-flex items-center font-medium rounded-md border transition-colors bg-red-50 text-red-600 border-red-200 disabled:opacity-50'
              : (syncAllCooldownUntil || overLimit)
              ? 'inline-flex items-center font-medium rounded-md border transition-colors border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
              : 'inline-flex items-center font-medium rounded-md border transition-colors border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
          }
          style={{fontSize: 11, padding: '4px 10px', gap: 5}}
        >
          {syncAllStatus === 'running' ? (
            <svg className="animate-spin" style={{width: 12, height: 12}} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg style={{width: 12, height: 12}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {syncAllStatus === 'done' ? 'Synced' : syncAllStatus === 'error' ? 'Error' : syncAllStatus === 'running' ? 'Syncing…' : 'Sync All'}
        </button>
      </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {products.length === 0 ? (
          <div className="text-center text-gray-400" style={{padding: 48}}>
            <p style={{fontSize: 13}}>No products tracked yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400" style={{padding: 36}}>
            <p style={{fontSize: 13}}>No products match your search.</p>
          </div>
        ) : (
          <>
            {/* Bulk-action bar — visible only when at least one product is selected */}
            {anyChecked && (
              <div className="flex items-center justify-between border-b border-red-100 bg-red-50" style={{padding: '8px 24px'}}>
                <span className="font-medium text-red-700" style={{fontSize: 12}}>
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => setBulkDeleteOpen(true)}
                  className="inline-flex items-center font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  style={{fontSize: 12, padding: '4px 10px', gap: 5}}
                >
                  <Trash2 style={{width: 13, height: 13}} />
                  Delete selected
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {/* Select-all checkbox */}
                    <th style={{padding: '8px 4px 8px 24px', width: 32}}>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every(p => selectedIds.has(p.id))}
                        onChange={handleSelectAll}
                        style={{width: 14, height: 14, cursor: 'pointer', accentColor: '#844CDA'}}
                      />
                    </th>
                    <th className="text-left font-semibold text-gray-500 uppercase tracking-wider" style={{fontSize: 10, padding: '8px 24px 8px 0'}}>Product</th>
                    <th className="text-left font-semibold text-gray-500 uppercase tracking-wider" style={{fontSize: 10, padding: '8px 16px'}}>Queen Price</th>
                    <th className="text-left font-semibold text-gray-500 uppercase tracking-wider" style={{fontSize: 10, padding: '8px 16px'}}>Last Synced</th>
                    <th className="text-right font-semibold text-gray-500 uppercase tracking-wider" style={{fontSize: 10, padding: '8px 24px'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([brand, brandProducts]) => (
                    <Fragment key={brand}>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={5} style={{padding: '5px 24px'}}>
                          <span className="font-semibold text-gray-500 uppercase tracking-wider capitalize" style={{fontSize: 10}}>{brand}</span>
                        </td>
                      </tr>
                      {brandProducts.map(product => {
                        const name = product.label || product.shopify_product_title || product.id
                        const syncStatus = syncStates[product.id] ?? 'idle'
                        const isDeleteConfirming = deleteId === product.id
                        const isSelected = selectedIds.has(product.id)
                        const productCooldownUntil = getNextSyncTime(product.last_synced_at, PRODUCT_COOLDOWN_MS)
                        const inCooldown = productCooldownUntil !== null

                        return (
                          <tr key={product.id} className="group hover:bg-gray-50 transition-colors border-t border-gray-100">
                            {/* Per-row checkbox — hidden until hovered or any row is checked */}
                            <td style={{padding: '9px 4px 9px 24px', width: 32}}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(product.id)}
                                className={anyChecked
                                  ? 'transition-opacity opacity-100'
                                  : 'transition-opacity opacity-0 group-hover:opacity-100'
                                }
                                style={{width: 14, height: 14, cursor: 'pointer', accentColor: '#844CDA'}}
                              />
                            </td>
                            <td className="font-medium text-gray-900 max-w-xs truncate" style={{fontSize: 13, padding: '9px 24px 9px 0'}}>{name}</td>
                            <td className="font-mono text-gray-900" style={{fontSize: 13, padding: '9px 16px'}}>{fmt(product.queen_sale_price)}</td>
                            <td className="text-gray-400" style={{fontSize: 11, padding: '9px 16px'}}>{timeAgo(product.last_synced_at)}</td>
                            <td style={{padding: '9px 24px'}}>
                              <div className="flex items-center justify-end" style={{gap: 6}}>
                                {isDeleteConfirming ? (
                                  <>
                                    <span className="font-medium text-red-600" style={{fontSize: 11}}>Delete?</span>
                                    <button
                                      onClick={() => handleDelete(product.id)}
                                      disabled={deleting}
                                      className="font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-60"
                                      style={{fontSize: 11, padding: '4px 8px'}}
                                    >
                                      {deleting ? '…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => setDeleteId(null)}
                                      className="font-medium border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
                                      style={{fontSize: 11, padding: '4px 8px'}}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => inCooldown ? showCooldownToast(productCooldownUntil!) : handleSync(product.id)}
                                      disabled={syncStatus !== 'idle' || overLimit}
                                      title={overLimit ? 'Remove brands to sync' : 'Sync prices'}
                                      className={
                                        syncStatus === 'done'
                                          ? 'inline-flex items-center font-medium rounded-md border transition-colors bg-green-50 text-green-700 border-green-200 disabled:opacity-50'
                                          : syncStatus === 'error'
                                          ? 'inline-flex items-center font-medium rounded-md border transition-colors bg-red-50 text-red-600 border-red-200 disabled:opacity-50'
                                          : 'inline-flex items-center font-medium rounded-md border transition-colors border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                                      }
                                      style={{fontSize: 11, padding: '4px 8px', gap: 4}}
                                    >
                                      {syncStatus === 'checking' ? (
                                        <svg className="animate-spin" style={{width: 12, height: 12}} fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                      ) : (
                                        <svg style={{width: 12, height: 12}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      )}
                                      {syncStatus === 'done' ? 'Synced' : syncStatus === 'error' ? 'Error' : syncStatus === 'checking' ? 'Syncing…' : 'Sync'}
                                    </button>

                                    <button
                                      onClick={() => openEdit(product)}
                                      title="Edit product"
                                      className="border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                                      style={{padding: 5}}
                                    >
                                      <Pencil style={{width: 13, height: 13}} />
                                    </button>

                                    <button
                                      onClick={() => setStatsId(product.id)}
                                      title="Price history"
                                      className="border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                                      style={{padding: 5}}
                                    >
                                      <BarChart2 style={{width: 13, height: 13}} />
                                    </button>

                                    <button
                                      onClick={() => setDeleteId(product.id)}
                                      title="Delete product"
                                      className="border border-gray-200 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                      style={{padding: 5}}
                                    >
                                      <Trash2 style={{width: 13, height: 13}} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editId && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl overflow-y-auto" style={{width: '100%', maxWidth: 420, maxHeight: '90vh'}}>
            <div className="flex items-center justify-between border-b border-gray-100" style={{padding: '10px 20px'}}>
              <h2 className="font-semibold text-gray-900" style={{fontSize: 13}}>
                {editProduct?.label || editProduct?.shopify_product_title || 'Edit Product'}
              </h2>
              <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                <svg style={{width: 15, height: 15}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14}}>
              {/* Product ID */}
              <div>
                <label className="block font-medium text-gray-700" style={{fontSize: 11, marginBottom: 4}}>
                  {storePlatform === 'woocommerce' ? 'WooCommerce Product ID' : 'Shopify Product ID'}
                </label>
                <input
                  type="text"
                  value={editForm.shopifyProductId}
                  onChange={e => setEditForm(f => f && ({ ...f, shopifyProductId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. 7891234567890"
                  style={{fontSize: 13, padding: '5px 10px'}}
                />
              </div>

              {/* Label */}
              <div>
                <label className="block font-medium text-gray-700" style={{fontSize: 11, marginBottom: 4}}>
                  Custom label <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editForm.label}
                  onChange={e => setEditForm(f => f && ({ ...f, label: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Override display name"
                  style={{fontSize: 13, padding: '5px 10px'}}
                />
              </div>

              {/* Price Mode */}
              <div>
                <label className="block font-medium text-gray-700" style={{fontSize: 11, marginBottom: 4}}>Price Mode</label>
                <div className="flex" style={{gap: 8}}>
                  {(['match', 'markup'] as const).map(val => (
                    <label
                      key={val}
                      className={editForm.priceMode === val
                        ? 'flex-1 flex items-center justify-center rounded-lg border-2 cursor-pointer transition-colors border-blue-600 bg-blue-50 text-blue-800'
                        : 'flex-1 flex items-center justify-center rounded-lg border-2 cursor-pointer transition-colors border-gray-200 text-gray-900 hover:border-gray-300'
                      }
                      style={{gap: 7, padding: '7px 10px'}}
                    >
                      <input
                        type="radio"
                        name="priceMode"
                        value={val}
                        checked={editForm.priceMode === val}
                        onChange={() => setEditForm(f => f && ({ ...f, priceMode: val }))}
                        className="accent-blue-600"
                      />
                      <span className="font-medium" style={{fontSize: 11}}>
                        {val === 'match' ? 'Match Manufacturer Price' : 'Add Markup'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Markup fields */}
              {editForm.priceMode === 'markup' && (
                <div className="bg-gray-50 rounded-lg" style={{padding: 12, display: 'flex', flexDirection: 'column', gap: 8}}>
                  <div className="flex" style={{gap: 6}}>
                    {(['fixed', 'percentage'] as const).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setEditForm(f => f && ({ ...f, markupType: val }))}
                        className={editForm.markupType === val
                          ? 'flex-1 font-semibold rounded-md border transition-colors bg-blue-600 text-white border-blue-600'
                          : 'flex-1 font-semibold rounded-md border transition-colors bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }
                        style={{fontSize: 11, padding: '4px 0'}}
                      >
                        {val === 'fixed' ? '$ Fixed amount' : '% Percentage'}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    {editForm.markupType === 'fixed' && (
                      <span className="absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" style={{left: 9, fontSize: 12}}>$</span>
                    )}
                    <input
                      type="number"
                      min="0"
                      step={editForm.markupType === 'fixed' ? '1' : '0.1'}
                      value={editForm.markupValue}
                      onChange={e => setEditForm(f => f && ({ ...f, markupValue: e.target.value }))}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={editForm.markupType === 'fixed'
                        ? {fontSize: 13, padding: '5px 10px 5px 22px'}
                        : {fontSize: 13, padding: '5px 22px 5px 10px'}
                      }
                    />
                    {editForm.markupType === 'percentage' && (
                      <span className="absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" style={{right: 9, fontSize: 12}}>%</span>
                    )}
                  </div>
                  <p className="text-gray-500" style={{fontSize: 11}}>
                    Added {editForm.markupType === 'fixed' ? 'as a fixed dollar amount' : 'as a percentage'} on top of the manufacturer sale price.
                  </p>
                </div>
              )}

              {/* Price Guardrail */}
              <div>
                <label className="block font-medium text-gray-700" style={{fontSize: 11, marginBottom: 2}}>
                  Price Guardrail <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <p className="text-gray-500" style={{fontSize: 11, marginBottom: 8}}>
                  If the computed price falls outside this range, the sync is skipped.
                </p>
                <div className="flex items-end" style={{gap: 8}}>
                  <div className="flex-1">
                    <p className="font-medium text-gray-600 text-center" style={{fontSize: 11, marginBottom: 4}}>Min price</p>
                    <div className="relative">
                      <span className="absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" style={{left: 9, fontSize: 12}}>$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editForm.guardrailMin}
                        onChange={e => setEditForm(f => f && ({ ...f, guardrailMin: e.target.value }))}
                        placeholder="e.g. 500"
                        className="w-full border border-gray-300 rounded-lg text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                        style={{fontSize: 13, padding: '5px 8px 5px 22px'}}
                      />
                    </div>
                  </div>
                  <span className="text-gray-400" style={{fontSize: 13, paddingBottom: 6}}>–</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-600 text-center" style={{fontSize: 11, marginBottom: 4}}>Max price</p>
                    <div className="relative">
                      <span className="absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" style={{left: 9, fontSize: 12}}>$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editForm.guardrailMax}
                        onChange={e => setEditForm(f => f && ({ ...f, guardrailMax: e.target.value }))}
                        placeholder="e.g. 2000"
                        className="w-full border border-gray-300 rounded-lg text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                        style={{fontSize: 13, padding: '5px 8px 5px 22px'}}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {editError && (
                <p className="text-red-600 bg-red-50 rounded-lg" style={{fontSize: 13, padding: '6px 12px'}}>{editError}</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100" style={{padding: '10px 20px'}}>
              <button
                onClick={() => { setDeleteId(editId); setEditId(null) }}
                className="font-medium text-red-500 hover:text-red-700 transition-colors"
                style={{fontSize: 11}}
              >
                Delete product
              </button>
              <div className="flex" style={{gap: 8}}>
                <button
                  onClick={() => setEditId(null)}
                  className="font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{fontSize: 11, padding: '5px 12px'}}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                  style={{fontSize: 11, padding: '5px 12px'}}
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single-product delete confirmation modal */}
      {deleteId && !editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete product?</h2>
            <p className="text-sm text-gray-500 mb-6">
              This will remove the product and all its price history. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 text-sm font-medium py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 text-sm font-semibold py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !bulkDeleting && setBulkDeleteOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Delete {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''}?
            </h2>
            <p className="text-sm text-gray-500 mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleting}
                className="flex-1 text-sm font-medium py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 text-sm font-semibold py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                {bulkDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {statsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStatsId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                Price History — {statsProduct?.label || statsProduct?.shopify_product_title}
              </h2>
              <button onClick={() => setStatsId(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon />
              </button>
            </div>
            <div className="p-6">
              {statsLoading ? (
                <div className="flex items-center justify-center h-52 text-gray-400 text-sm">
                  Loading price history…
                </div>
              ) : statsChartData.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-52 text-gray-400 text-sm gap-1">
                  <span>{statsChartData.length === 0 ? 'No price history recorded yet.' : 'Not enough data to show a trend.'}</span>
                  <span className="text-xs">Sync this product at least twice to see price movement.</span>
                </div>
              ) : (
                <PriceChart data={statsChartData} sizes={statsSizes} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cooldown toast */}
      {cooldownToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 max-w-xs">
          <svg className="shrink-0 mt-0.5 text-amber-400" style={{width: 15, height: 15}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{flex: 1}}>
            <p className="font-semibold" style={{fontSize: 12}}>Sync cooldown active</p>
            <p className="text-gray-300" style={{fontSize: 11, marginTop: 2}}>{cooldownToast}</p>
          </div>
          <button onClick={() => setCooldownToast(null)} className="shrink-0 text-gray-400 hover:text-white" style={{fontSize: 14, lineHeight: 1}}>✕</button>
        </div>
      )}
    </>
  )
}
