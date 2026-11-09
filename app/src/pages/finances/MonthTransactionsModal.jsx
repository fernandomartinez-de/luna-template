import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../supabaseClient'
import { CURRENCY, MONEY_LOCALE } from '../../config.js'

const CAT_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#84cc16', '#0ea5e9', '#8b5cf6', '#ec4899', '#22c55e', '#eab308', '#06b6d4', '#a855f7', '#f43f5e']

// Order the groups appear in "All" view. Uncategorized sits right after
// Discretionary so anything the card is missing is easy to spot.
const GROUP_ORDER = ['Discretionary', 'Uncategorized', 'Fixed Costs', 'Excluded']
const GROUP_NOTES = {
  Discretionary: 'Counted in the Discretionary Spending card',
  Uncategorized: 'No category yet, so not counted anywhere on this page',
  'Fixed Costs': 'Counted in Income & Expenses',
  Excluded: 'Payroll, transfers and card payments, not counted as spending'
}

function usd(n, digits = 2) {
  return (Number(n) || 0).toLocaleString(MONEY_LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function monthLong(key) {
  if (!key) return ''
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function dayLabel(d) {
  if (!d) return ''
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

// Mirrors vw_discretionary_summary: Discretionary group, minus the
// Miscellaneous outlier rule, summed as absolute values.
function groupFor(t, groupByCategory) {
  if (!t.category) return 'Uncategorized'
  const g = groupByCategory[t.category]
  if (!g) return 'Uncategorized'
  if (g === 'Discretionary' && t.category === 'Miscellaneous' && Math.abs(Number(t.amount) || 0) > 100000) return 'Excluded'
  return g
}

export default function MonthTransactionsModal({ month, onClose, onChanged }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [txns, setTxns] = useState([])
  const [groupByCategory, setGroupByCategory] = useState({})
  const [view, setView] = useState('discretionary')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [txRes, grpRes] = await Promise.all([
          supabase.from('expense_transactions')
            .select('*') // '*' so this still loads before category_manual exists
            .eq('month', month)
            .order('transaction_date', { ascending: false })
            .limit(5000),
          supabase.from('vw_category_groups').select('category, category_group')
        ])
        if (txRes.error) throw txRes.error
        if (grpRes.error) throw grpRes.error
        if (cancelled) return
        const map = {}
        ;(grpRes.data || []).forEach((r) => { map[r.category] = r.category_group })
        setGroupByCategory(map)
        setTxns(txRes.data || [])
      } catch (e) {
        if (!cancelled) setError(e.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [month])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (editing) setEditing(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  const categoryOptions = useMemo(() => {
    const byGroup = {}
    Object.entries(groupByCategory).forEach(([cat, g]) => {
      if (!cat || cat === 'null') return
      byGroup[g] = byGroup[g] || []
      byGroup[g].push(cat)
    })
    Object.values(byGroup).forEach((list) => list.sort((a, b) => a.localeCompare(b)))
    return ['Discretionary', 'Fixed Costs', 'Excluded']
      .filter((g) => byGroup[g])
      .map((g) => ({ group: g, cats: byGroup[g] }))
  }, [groupByCategory])

  async function saveCategory(txn, category, rememberPattern) {
    const { data, error: rpcError } = await supabase.rpc('recategorize_transaction', {
      p_id: txn.id,
      p_category: category || null,
      p_remember_pattern: rememberPattern || null
    })
    if (rpcError) {
      if (rpcError.code === 'PGRST202' || /recategorize_transaction/.test(rpcError.message || '')) {
        throw new Error('Saving categories needs the latest database update. It has not been applied yet.')
      }
      throw rpcError
    }
    const pat = (rememberPattern || '').trim().toUpperCase()
    setTxns((prev) => prev.map((t) => {
      if (t.id === txn.id) return { ...t, category: category || null, category_manual: !!category }
      if (pat && category && !t.category && String(t.description || '').toUpperCase().includes(pat)) return { ...t, category }
      return t
    }))
    if (category && !groupByCategory[category]) {
      setGroupByCategory((prev) => ({ ...prev, [category]: 'Discretionary' }))
    }
    const extra = data && data.also_applied ? ` and ${data.also_applied} similar` : ''
    setToast(category ? `Moved to ${category}${extra}` : 'Category cleared')
    setEditing(null)
    if (onChanged) onChanged()
  }

  const groups = useMemo(() => {
    const byGroup = {}
    txns.forEach((t) => {
      const g = groupFor(t, groupByCategory)
      const cat = t.category || 'No category'
      byGroup[g] = byGroup[g] || { name: g, total: 0, count: 0, cats: {} }
      byGroup[g].cats[cat] = byGroup[g].cats[cat] || { name: cat, total: 0, rows: [] }
      const abs = Math.abs(Number(t.amount) || 0)
      byGroup[g].total += abs
      byGroup[g].count += 1
      byGroup[g].cats[cat].total += abs
      byGroup[g].cats[cat].rows.push(t)
    })
    const order = (n) => { const i = GROUP_ORDER.indexOf(n); return i === -1 ? 99 : i }
    return Object.values(byGroup)
      .map((g) => ({ ...g, cats: Object.values(g.cats).sort((a, b) => b.total - a.total) }))
      .sort((a, b) => order(a.name) - order(b.name))
  }, [txns, groupByCategory])

  const moneyOut = txns.reduce((s, t) => s + (Number(t.amount) < 0 ? -Number(t.amount) : 0), 0)
  const moneyIn = txns.reduce((s, t) => s + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0)
  const disc = groups.find((g) => g.name === 'Discretionary')
  const uncategorized = groups.find((g) => g.name === 'Uncategorized')
  const shownGroups = view === 'all'
    ? groups
    : groups.filter((g) => g.name === 'Discretionary' || g.name === 'Uncategorized')

  const q = query.trim().toLowerCase()
  const matches = (t) => !q || String(t.description || '').toLowerCase().includes(q) || String(t.category || '').toLowerCase().includes(q)

  const label = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: 0 }
  const chip = (active) => ({
    fontSize: '12px', padding: '5px 12px', borderRadius: '999px', cursor: 'pointer', fontWeight: 600,
    border: active ? '1px solid var(--brand-500)' : '1px solid var(--surface-border)',
    background: active ? 'var(--brand-500)' : 'transparent',
    color: active ? '#fff' : 'var(--tx-secondary)'
  })

  let colorIdx = 0

  // Portal to <body> so the overlay sits above the bottom nav instead of
  // being trapped in the page content's stacking context.
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'calc(var(--sa-top, 0px) + 16px) calc(var(--sa-right, 0px) + 16px) calc(var(--sa-bottom, 0px) + 16px) calc(var(--sa-left, 0px) + 16px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Transactions for ${monthLong(month)}`}
        style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '16px 16px 12px 16px', borderBottom: '1px solid var(--surface-border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={label}>Transactions · {monthLong(month)}</p>
              <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '4px 0 0 0' }}>
                {loading ? 'Loading…' : `${txns.length} transactions this month`}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}
            >×</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => setView('discretionary')} style={chip(view === 'discretionary')}>Discretionary</button>
            <button type="button" onClick={() => setView('all')} style={chip(view === 'all')}>All transactions</button>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              style={{ flex: 1, minWidth: '120px', fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)' }}
            />
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 16px 16px 16px' }}>
          {loading && <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>Loading transactions…</div>}
          {error && <div style={{ fontSize: '13px', color: '#f87171' }}>Couldn't load transactions: {error}</div>}

          {!loading && !error && uncategorized && view === 'discretionary' && (
            <div style={{ fontSize: '12px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
              {uncategorized.count} uncategorized {uncategorized.count === 1 ? 'transaction' : 'transactions'} ({usd(uncategorized.total)}) aren't counted in the card total. They're listed at the bottom.
            </div>
          )}

          {!loading && !error && shownGroups.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No transactions this month.</div>
          )}

          {!loading && !error && shownGroups.map((g) => {
            const warn = g.name === 'Uncategorized'
            return (
              <div key={g.name} style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--surface-border)', marginBottom: '8px' }}>
                  <span style={{ ...label, color: warn ? '#fbbf24' : 'var(--tx-primary)', flex: 1 }}>{g.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{g.count}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: warn ? '#fbbf24' : 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(g.total)}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '-4px 0 10px 0' }}>{GROUP_NOTES[g.name] || ''}</p>

                {g.cats.map((c) => {
                  const rows = c.rows.filter(matches)
                  if (rows.length === 0) return null
                  const color = warn ? '#fbbf24' : CAT_COLORS[colorIdx++ % CAT_COLORS.length]
                  return (
                    <div key={c.name} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--tx-primary)', fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>×{c.rows.length}</span>
                        <span style={{ color: 'var(--tx-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{usd(c.total)}</span>
                      </div>
                      <div style={{ marginLeft: '16px' }}>
                        {rows.map((t) => {
                          const amt = Number(t.amount) || 0
                          const credit = amt > 0
                          return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', padding: '4px 0', borderBottom: '1px dashed rgba(148,163,184,0.12)' }}>
                              <span style={{ width: '44px', flexShrink: 0, color: 'var(--tx-muted)', fontVariantNumeric: 'tabular-nums' }}>{dayLabel(t.transaction_date)}</span>
                              <span style={{ flex: 1, color: 'var(--tx-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.description}>
                                {t.description}
                                {t.source && <span style={{ color: 'var(--tx-muted)', fontSize: '10px', marginLeft: '6px' }}>{t.source}</span>}
                                {t.category_manual && <span title="Set by you; the bank sync won't change it" style={{ color: 'var(--brand-500)', fontSize: '10px', marginLeft: '6px' }}>edited</span>}
                              </span>
                              <span style={{ color: credit ? '#10b981' : 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                {credit ? `+${usd(amt)}` : usd(Math.abs(amt))}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditing(t)}
                                aria-label={`Change category for ${t.description}`}
                                title="Change category"
                                style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', padding: '0 2px', margin: '-4px -4px -4px 0', fontSize: '16px', lineHeight: 1, width: '24px', flexShrink: 0, alignSelf: 'center' }}
                              >⋯</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {!loading && !error && view === 'all' && groups.length > 0 && (
            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '10px', fontSize: '12px' }}>
              {groups.map((g) => (
                <div key={g.name} style={{ display: 'flex', padding: '2px 0', color: 'var(--tx-secondary)' }}>
                  <span style={{ flex: 1 }}>{g.name} ({g.count})</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(g.total)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', paddingTop: '6px', marginTop: '4px', borderTop: '1px solid var(--surface-border)', fontWeight: 700, color: 'var(--tx-primary)' }}>
                <span style={{ flex: 1 }}>Money out</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(moneyOut)}</span>
              </div>
              <div style={{ display: 'flex', padding: '2px 0', fontWeight: 700, color: '#10b981' }}>
                <span style={{ flex: 1 }}>Money in</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>+{usd(moneyIn)}</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>
                {groups.reduce((s, g) => s + g.count, 0)} of {txns.length} transactions accounted for
              </p>
            </div>
          )}

          {!loading && !error && view === 'discretionary' && disc && (
            <div style={{ display: 'flex', paddingTop: '10px', borderTop: '1px solid var(--surface-border)', fontSize: '13px', fontWeight: 700 }}>
              <span style={{ flex: 1, color: 'var(--tx-primary)' }}>Discretionary total ({disc.count})</span>
              <span style={{ color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(disc.total)}</span>
            </div>
          )}
        </div>
      </div>
      {editing && (
        <CategorizeSheet
          txn={editing}
          options={categoryOptions}
          onCancel={() => setEditing(null)}
          onSave={saveCategory}
        />
      )}
      {toast && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 'calc(var(--sa-bottom, 0px) + 24px)', transform: 'translateX(-50%)', background: 'var(--surface-raised)', border: '1px solid var(--brand-500)', color: 'var(--tx-primary)', fontSize: '13px', padding: '8px 14px', borderRadius: '999px', zIndex: 1200, boxShadow: '0 6px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>,
    document.body
  )
}

function defaultPattern(description) {
  const words = String(description || '')
    .toUpperCase()
    .replace(/^(TST\*|SQ \*|CPP\*|SP |GLF\*)\s*/, '')
    .replace(/[^A-Z&' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words.slice(0, 3).join(' ')
}

function CategorizeSheet({ txn, options, onCancel, onSave }) {
  const [selected, setSelected] = useState(txn.category || '')
  const [custom, setCustom] = useState('')
  const [remember, setRemember] = useState(!txn.category)
  const [pattern, setPattern] = useState(defaultPattern(txn.description))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const finalCategory = custom.trim() || selected
  const amt = Number(txn.amount) || 0

  async function submit() {
    setSaving(true)
    setErr(null)
    try {
      await onSave(txn, finalCategory, remember && finalCategory ? pattern : null)
    } catch (e) {
      setErr(e.message || String(e))
      setSaving(false)
    }
  }

  const chipStyle = (active) => ({
    fontSize: '12px', padding: '6px 10px', borderRadius: '999px', cursor: 'pointer',
    border: active ? '1px solid var(--brand-500)' : '1px solid var(--surface-border)',
    background: active ? 'var(--brand-500)' : 'transparent',
    color: active ? '#fff' : 'var(--tx-secondary)', fontWeight: active ? 600 : 500
  })

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onCancel() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1100, padding: '0 calc(var(--sa-right, 0px) + 8px) 0 calc(var(--sa-left, 0px) + 8px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Change category"
        style={{ width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '14px 14px 0 0', padding: '16px 16px calc(var(--sa-bottom, 0px) + 16px) 16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: 0 }}>Change category</p>
            <p style={{ fontSize: '14px', color: 'var(--tx-primary)', fontWeight: 600, margin: '6px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description}</p>
            <p style={{ fontSize: '12px', color: 'var(--tx-muted)', margin: 0 }}>
              {dayLabel(txn.transaction_date)} · {amt > 0 ? `+${usd(amt)}` : usd(Math.abs(amt))} · now {txn.category || 'uncategorized'}
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close" style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {options.map((o) => (
          <div key={o.group} style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 6px 0' }}>{o.group}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {o.cats.map((c) => (
                <button key={c} type="button" onClick={() => { setSelected(c); setCustom('') }} style={chipStyle(!custom.trim() && selected === c)}>{c}</button>
              ))}
            </div>
          </div>
        ))}

        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Or type a new category"
          maxLength={60}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)', marginBottom: '12px' }}
        />

        <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--tx-secondary)', marginBottom: remember ? '6px' : '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ marginTop: '2px' }} />
          <span>Remember this: future transactions containing the text below get this category, and so do uncategorized ones already here.</span>
        </label>
        {remember && (
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value.toUpperCase())}
            aria-label="Text to match"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)', marginBottom: '14px', fontFamily: 'ui-monospace, monospace' }}
          />
        )}

        {err && <p style={{ fontSize: '12px', color: '#f87171', margin: '0 0 10px 0' }}>Couldn't save: {err}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          {txn.category && (
            <button type="button" disabled={saving} onClick={() => onSave(txn, null, null).catch((e) => setErr(e.message || String(e)))}
              style={{ fontSize: '13px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer' }}>
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={saving || !finalCategory || (remember && pattern.trim().length < 3) || (finalCategory === (txn.category || '') && !remember)}
            style={{ flex: 1, fontSize: '14px', fontWeight: 700, padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'var(--brand-500)', color: '#fff', cursor: 'pointer', opacity: saving || !finalCategory ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : finalCategory ? `Save as ${finalCategory}` : 'Pick a category'}
          </button>
        </div>
      </div>
    </div>
  )
}
