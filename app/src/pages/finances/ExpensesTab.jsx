import { useEffect, useState } from 'react'
import MonthTransactionsModal from './MonthTransactionsModal.jsx'
import AlertsCard from './AlertsCard.jsx'
import { supabase } from '../../supabaseClient'
import CodeSlots from '../../components/CodeSlots/CodeSlots.jsx'
import { checkPin } from '../../utils/pin.js'
import { CURRENCY, MONEY_LOCALE } from '../../config.js'

const CAT_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#84cc16', '#0ea5e9', '#8b5cf6', '#ec4899', '#22c55e', '#eab308', '#06b6d4', '#a855f7', '#f43f5e']

const HEATMAP_COLORS = ['#60a5fa', '#a78bfa', '#2dd4bf', '#fbbf24', '#fb7185', '#a3e635', '#818cf8', '#22d3ee', '#f472b6', '#34d399', '#fb923c', '#c084fc']

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function usd(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString(MONEY_LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function lastCompleteMonthKey() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`
}
function monthShort(key) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

const CATEGORY_EMOJI = {
  'Rent': '🏠',
  'Mortgage Payment': '🏠',
  'Community Fees': '🏢',
  'Electricity': '⚡',
  'Water': '💧',
  'Gas': '🔥',
  'Internet / Phone': '📶',
  'Insurance': '🛡️',
  'Gym': '🏋️',
  'Transport': '🚇',
  'Subscriptions': '🧾'
}

function AccentRow({ color, emoji, name, subtitle, amount, tone, onClick }) {
  const bg = tone === 'income' || tone === 'net'
    ? 'rgba(16,185,129,0.10)'
    : 'var(--surface-base)'
  const border = tone === 'income' || tone === 'net'
    ? '1px solid rgba(16,185,129,0.35)'
    : '1px solid var(--surface-border)'
  const amountColor = tone === 'income' || tone === 'net' ? '#10b981' : 'var(--tx-primary)'
  const nameColor = tone === 'income' || tone === 'net' ? '#10b981' : 'var(--tx-primary)'
  const style = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    background: bg,
    border,
    borderLeft: `4px solid ${color}`,
    cursor: onClick ? 'pointer' : 'default',
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
    width: '100%'
  }
  const inner = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: nameColor, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {emoji && <span style={{ fontSize: '0.95rem' }}>{emoji}</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
        {subtitle && <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: amountColor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{usd(amount)}</div>
    </>
  )
  return onClick
    ? <button type="button" onClick={onClick} style={style}>{inner}</button>
    : <div style={style}>{inner}</div>
}

function PayrollLockedRow({ income, unlocked, setUnlocked }) {
  const [status, setStatus] = useState('idle')
  const [pinValue, setPinValue] = useState('')

  const handleComplete = async (code) => {
    let ok = false
    try { ok = await checkPin(code) } catch (e) { ok = false }
    if (ok) {
      setStatus('success')
      setTimeout(() => setUnlocked(true), 320)
    } else {
      setStatus('danger')
      setTimeout(() => {
        setPinValue('')
        setStatus('idle')
      }, 720)
    }
  }

  if (unlocked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.35)', borderLeft: '4px solid #10b981' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💰</span><span>Monthly Payroll</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '2px' }}>Income · <button onClick={() => { setUnlocked(false); setStatus('idle'); setPinValue('') }} style={{ background: 'transparent', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 600, textDecoration: 'underline' }}>lock</button></div>
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {income != null && !isNaN(income) ? Number(income).toLocaleString(MONEY_LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderLeft: '4px solid #10b981' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🔒</span><span>Monthly Payroll</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '2px' }}>Enter 4-digit code to reveal</div>
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--tx-muted)', letterSpacing: '0.15em', flexShrink: 0 }}>••••</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <CodeSlots
          length={4}
          value={pinValue}
          onChange={setPinValue}
          onComplete={handleComplete}
          status={status}
          autoFocus={false}
          slotSize={36}
          gap={6}
          radius={10}
          accentColor="#10b981"
          slotColor="rgba(255,255,255,0.06)"
          digitColor="#f1f5f9"
          inkColor="#f1f5f9"
          dangerColor="#ef4444"
          ariaLabel="Payroll unlock code"
        />
      </div>
    </div>
  )
}

function IncomeExpensesList({ income, fixedForDisplay, mtaAmount, subsAmount }) {
  const [unlocked, setUnlocked] = useState(false)
  const fixedTotal = fixedForDisplay.reduce((s, r) => s + r.amount, 0)
  const netRemaining = income - fixedTotal
  const fixedCore = fixedForDisplay.filter((r) => r.category !== 'Transport' && r.category !== 'Subscriptions')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <PayrollLockedRow income={income} unlocked={unlocked} setUnlocked={setUnlocked} />
      <div style={{ height: '1px', background: 'var(--surface-border)', margin: '2px 0' }} />
      {fixedCore.map((r, i) => (
        <AccentRow
          key={r.category}
          color={CAT_COLORS[i % CAT_COLORS.length]}
          emoji={CATEGORY_EMOJI[r.category]}
          name={r.category}
          subtitle="Current month"
          amount={r.amount}
        />
      ))}
      {mtaAmount > 0 && (
        <AccentRow color="#3b82f6" emoji={CATEGORY_EMOJI['Transport']} name="Transport" subtitle="Last complete month" amount={mtaAmount} />
      )}
      {subsAmount > 0 && (
        <AccentRow color="#8b5cf6" emoji={CATEGORY_EMOJI['Subscriptions']} name="Subscriptions" subtitle="Last complete month" amount={subsAmount} />
      )}
      <div style={{ height: '1px', background: 'var(--surface-border)', margin: '2px 0' }} />
      {unlocked
        ? <AccentRow color="#10b981" name="Net Remaining" subtitle="After all expenses" amount={netRemaining} tone="net" />
        : <AccentRow color="#10b981" name="Net Remaining" subtitle="Unlock payroll to reveal" amount={null} tone="net" />
      }
    </div>
  )
}

export default function ExpensesTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [fixed, setFixed] = useState([])
  const [electricityAvg, setElectricityAvg] = useState(0)
  const [mtaAmount, setMtaAmount] = useState(0)
  const [subsAmount, setSubsAmount] = useState(0)
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [subscriptionsList, setSubscriptionsList] = useState([])
  const [subsModalOpen, setSubsModalOpen] = useState(false)
  const [income, setIncome] = useState(0)
  const [nrHover, setNrHover] = useState(null)
  const [heatHover, setHeatHover] = useState(null)
  const [discretionary, setDiscretionary] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [payrollByMonth, setPayrollByMonth] = useState({})
  const [netRemainingTrend, setNetRemainingTrend] = useState([])
  const [monthFilter, setMonthFilter] = useState(null)
  const [txnModalOpen, setTxnModalOpen] = useState(false)

  useEffect(() => { loadAll() }, [])

  // Re-pull card data after a recategorization without the loading spinner.
  function refreshQuietly() { loadAll(true) }

  async function loadAll(quiet = false) {
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const lastMonth = lastCompleteMonthKey()

      const [statsRes, fixedRes, discRes, allRes, payrollRes, mtaRes, subsRes, elecRes, incomeRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats'),
        supabase.from('vw_fixed_costs_summary').select('*').order('avg_per_month', { ascending: false }),
        supabase.from('vw_discretionary_summary').select('*').order('month', { ascending: true }),
        supabase.from('vw_dashboard_summary').select('*').order('month', { ascending: true }),
        supabase.from('expense_transactions').select('month, amount').eq('category', 'Payroll').order('month', { ascending: true }),
        supabase.from('expense_transactions').select('amount').eq('category', 'Transport').eq('month', lastMonth),
        supabase.from('expense_transactions').select('description, amount').eq('category', 'Subscriptions').eq('month', lastMonth),
        supabase.from('expense_transactions').select('amount, transaction_date').eq('category', 'Electricity').gte('transaction_date', new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString()),
        supabase.from('expense_transactions').select('amount').eq('category', 'Payroll').order('transaction_date', { ascending: false }).limit(2)
      ])
      if (statsRes.error) throw statsRes.error
      if (fixedRes.error) throw fixedRes.error
      if (discRes.error) throw discRes.error
      if (allRes.error) throw allRes.error
      if (payrollRes.error) throw payrollRes.error

      const s = statsRes.data && statsRes.data.length > 0 ? statsRes.data[0] : {}
      setStats(s)
      setFixed(fixedRes.data || [])
      setDiscretionary(discRes.data || [])
      setAllCategories(allRes.data || [])

      const elecAvg = elecRes.data && elecRes.data.length > 0
        ? elecRes.data.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0) / elecRes.data.length
        : 0
      setElectricityAvg(elecAvg)

      setMtaAmount((mtaRes.data || []).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0))
      setSubsAmount((subsRes.data || []).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0))

      const grouped = {}
      ;(subsRes.data || []).forEach((s) => {
        const firstWord = String(s.description || '').split(/[\s*]/)[0].toLowerCase().trim()
        if (!firstWord) return
        if (!grouped[firstWord]) grouped[firstWord] = { name: firstWord, amount: 0, count: 0 }
        grouped[firstWord].amount += Math.abs(Number(s.amount) || 0)
        grouped[firstWord].count += 1
      })
      const subsRows = Object.values(grouped)
        .map((r) => ({ ...r, name: r.name.charAt(0).toUpperCase() + r.name.slice(1) }))
        .sort((a, b) => b.amount - a.amount)
      setSubscriptionsList(subsRows)
      setSubscriptionCount(subsRows.length)

      const pm = {}
      ;(payrollRes.data || []).forEach((r) => { pm[r.month] = (pm[r.month] || 0) + Math.abs(Number(r.amount) || 0) })
      setPayrollByMonth(pm)

      const monthlyIncome = (incomeRes.data || []).reduce((a, p) => a + Math.abs(Number(p.amount) || 0), 0)
      setIncome(monthlyIncome)

      const trend = buildNetRemainingTrend(pm, allRes.data || [], elecAvg)
      setNetRemainingTrend(trend)

      const months = [...new Set((discRes.data || []).map((r) => r.month))].sort()
      if (months.length > 0) setMonthFilter((prev) => (quiet && prev && months.includes(prev) ? prev : months[months.length - 1]))
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  function buildNetRemainingTrend(payMonth, allCats, elecAvg) {
    const totalsByMonth = {}
    allCats.forEach((r) => {
      const cost = r.category === 'Electricity' ? elecAvg : Number(r.total) || 0
      totalsByMonth[r.month] = (totalsByMonth[r.month] || 0) + cost
    })
    const months = Object.keys(totalsByMonth).sort()
    return months.map((m) => {
      const inc = payMonth[m] || 0
      return { month: m, netRemaining: inc - totalsByMonth[m], income: inc, expenses: totalsByMonth[m] }
    })
  }

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }
  const label = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 10px 0' }

  if (loading) return <div className="status-block">Loading expenses...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>

  const fixedForDisplay = fixed
    .map((r) => ({ category: r.category, amount: r.category === 'Electricity' ? electricityAvg : Number(r.avg_per_month) || 0 }))
    .concat([{ category: 'Transport', amount: mtaAmount }, { category: 'Subscriptions', amount: subsAmount }])
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const fixedTotal = fixedForDisplay.reduce((s, r) => s + r.amount, 0)

  const monthDiscRows = discretionary.filter((r) => r.month === monthFilter)
  const monthDiscTotal = monthDiscRows.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const topCatsInMonth = [...monthDiscRows]
    .map((r) => ({ category: r.category, total: Number(r.total) || 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const monthlyDiscTotals = {}
  discretionary.forEach((r) => {
    monthlyDiscTotals[r.month] = (monthlyDiscTotals[r.month] || 0) + (Number(r.total) || 0)
  })
  const trendMonths = Object.keys(monthlyDiscTotals).sort()
  const trendMax = Math.max(1, ...trendMonths.map((m) => monthlyDiscTotals[m]))

  const availableMonths = [...new Set(discretionary.map((r) => r.month))].sort()

  const nrMax = Math.max(1, ...netRemainingTrend.map((r) => Math.abs(r.netRemaining)))

  const catBreakdown = {}
  const catByMonth = {}
  const monthsSet = new Set()
  allCategories.forEach((r) => {
    const amt = Number(r.total) || 0
    catBreakdown[r.category] = (catBreakdown[r.category] || 0) + amt
    if (!catByMonth[r.category]) catByMonth[r.category] = {}
    catByMonth[r.category][r.month] = (catByMonth[r.category][r.month] || 0) + amt
    monthsSet.add(r.month)
  })
  const catBreakdownRows = Object.entries(catBreakdown)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
  const heatmapMonths = [...monthsSet].sort().slice(-12)
  const HEATMAP_EXCLUDE = new Set(['Mortgage Payment', 'HOA', 'Grindhouse'])
  const HEATMAP_FORCE_INCLUDE = ['Transport']
  const ranked = catBreakdownRows.filter((r) => !HEATMAP_EXCLUDE.has(r.category))
  const forced = HEATMAP_FORCE_INCLUDE
    .map((name) => catBreakdown[name] > 0 ? { category: name, total: catBreakdown[name] } : null)
    .filter(Boolean)
  const forcedNames = new Set(forced.map((r) => r.category))
  const combined = [...forced, ...ranked.filter((r) => !forcedNames.has(r.category))].slice(0, 12)
  const heatmapRows = combined.map((row) => {
    const values = heatmapMonths.map((m) => catByMonth[row.category]?.[m] || 0)
    const rowMax = Math.max(1, ...values)
    const rowAvg = values.reduce((a, v) => a + v, 0) / (values.length || 1)
    return { ...row, values, rowMax, rowAvg }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <AlertsCard card={card} label={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div style={card}>
          <p style={label}>Net Remaining</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{usd(stats?.net_remaining)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>after fixed costs</p>
        </div>
        <div style={card}>
          <p style={label}>Discretionary Avg</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{usd(stats?.discretionary_avg)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>per month</p>
        </div>
        <button
          onClick={() => setSubsModalOpen(true)}
          style={{ ...card, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', outline: 'none' }}
        >
          <p style={{ ...label, margin: 0 }}>Active Subscriptions</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: '10px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>{subscriptionCount}</p>
          <p style={{ fontSize: '11px', color: 'var(--brand-400)', margin: '6px 0 0 0', fontWeight: 600 }}>Tap to view →</p>
        </button>
        <div style={card}>
          <p style={label}>Months Tracked</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{stats?.months_tracked ?? '—'}</p>
        </div>
      </div>

      {subsModalOpen && (
        <div
          onClick={() => setSubsModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px', width: '100%', maxWidth: '460px', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <p style={{ ...label, margin: 0 }}>Active Subscriptions</p>
                <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '4px 0 0 0' }}>{subscriptionCount} · {usd(subsAmount)} last complete month</p>
              </div>
              <button
                onClick={() => setSubsModalOpen(false)}
                aria-label="Close"
                style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}
              >×</button>
            </div>
            {subscriptionsList.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No subscriptions in the last complete month.</div>
            ) : (
              <>
                <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px', background: 'var(--surface-muted)' }}>
                  {subscriptionsList.map((r, i) => (
                    <div key={r.name} style={{ background: CAT_COLORS[i % CAT_COLORS.length], width: `${(r.amount / Math.max(1, subsAmount)) * 100}%` }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {subscriptionsList.map((r, i) => {
                    const pct = subsAmount > 0 ? (r.amount / subsAmount) * 100 : 0
                    return (
                      <div key={r.name}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                          <span style={{ flex: 1, color: 'var(--tx-primary)', textTransform: 'capitalize', fontWeight: 500 }}>{r.name}</span>
                          {r.count > 1 && <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>×{r.count}</span>}
                          <span style={{ color: 'var(--tx-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{usd(r.amount)}</span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden', marginLeft: '16px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', paddingTop: '10px', borderTop: '1px solid var(--surface-border)', fontSize: '13px', fontWeight: 700 }}>
                    <span style={{ flex: 1, color: 'var(--tx-primary)' }}>Total</span>
                    <span style={{ color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(subsAmount)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <p style={label}>Income &amp; Expenses</p>
        <IncomeExpensesList
          income={income}
          fixedForDisplay={fixedForDisplay}
          mtaAmount={mtaAmount}
          subsAmount={subsAmount}
        />
      </div>

      <div style={card}>
        <p style={label}>Net Remaining Trend</p>
        {netRemainingTrend.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No trend data</div>
        ) : (
          <div style={{ width: '100%', height: '120px', position: 'relative' }}>
            <svg
              width="100%"
              height="120"
              viewBox="0 0 1000 120"
              preserveAspectRatio="none"
              onMouseLeave={() => setNrHover(null)}
              style={{ overflow: 'visible' }}
            >
              <line x1="0" y1="60" x2="1000" y2="60" stroke="var(--surface-border)" strokeDasharray="4 4" />
              <path
                d={netRemainingTrend.map((r, i) => {
                  const x = (i / Math.max(1, netRemainingTrend.length - 1)) * 1000
                  const y = 60 - (r.netRemaining / nrMax) * 50
                  return `${i === 0 ? 'M' : 'L'}${x},${y}`
                }).join(' ')}
                stroke="#10b981"
                strokeWidth="2"
                fill="none"
              />
              {netRemainingTrend.map((r, i) => {
                const x = (i / Math.max(1, netRemainingTrend.length - 1)) * 1000
                const y = 60 - (r.netRemaining / nrMax) * 50
                const active = nrHover === i
                return (
                  <circle
                    key={`pt-${i}`}
                    cx={x}
                    cy={y}
                    r={active ? 5 : 3}
                    fill={r.netRemaining >= 0 ? '#10b981' : '#ef4444'}
                    stroke={active ? 'var(--surface-base)' : 'none'}
                    strokeWidth={active ? 2 : 0}
                  />
                )
              })}
              {netRemainingTrend.map((r, i) => {
                const x = (i / Math.max(1, netRemainingTrend.length - 1)) * 1000
                const w = 1000 / Math.max(1, netRemainingTrend.length)
                return (
                  <rect
                    key={`hit-${i}`}
                    x={x - w / 2}
                    y={0}
                    width={w}
                    height={120}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setNrHover(i)}
                    onTouchStart={() => setNrHover(i)}
                  />
                )
              })}
            </svg>
            {nrHover !== null && (() => {
              const r = netRemainingTrend[nrHover]
              const leftPct = (nrHover / Math.max(1, netRemainingTrend.length - 1)) * 100
              const topPct = ((60 - (r.netRemaining / nrMax) * 50) / 120) * 100
              const flipLeft = leftPct > 70
              const flipUp = topPct < 30
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: `translate(${flipLeft ? '-100%' : '0'}, ${flipUp ? '8px' : '-100%'})`,
                    marginLeft: flipLeft ? '-8px' : '8px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    color: 'var(--tx-primary)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                    zIndex: 5
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>{monthShort(r.month)}</div>
                  <div style={{ color: r.netRemaining >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{usd(r.netRemaining)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--tx-muted)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {usd(r.income)} in · {usd(r.expenses)} out
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
              <span>{monthShort(netRemainingTrend[0].month)}</span>
              <span>{monthShort(netRemainingTrend[netRemainingTrend.length - 1].month)}</span>
            </div>
          </div>
        )}
      </div>

      <div
        style={{ ...card, cursor: monthFilter ? 'pointer' : 'default' }}
        role="button"
        tabIndex={0}
        onClick={() => { if (monthFilter) setTxnModalOpen(true) }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && monthFilter) { e.preventDefault(); setTxnModalOpen(true) } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ ...label, margin: 0 }}>Discretionary Spending</p>
          <select
            value={monthFilter || ''}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)' }}
          >
            {availableMonths.map((m) => (<option key={m} value={m}>{monthShort(m)}</option>))}
          </select>
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(monthDiscTotal)}</div>
        <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '4px 0 12px 0' }}>{monthFilter ? monthShort(monthFilter) : ''} spend</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topCatsInMonth.map((r, i) => {
            const pct = monthDiscTotal > 0 ? (r.total / monthDiscTotal) * 100 : 0
            return (
              <div key={r.category}>
                <div style={{ display: 'flex', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{r.category}</span>
                  <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(r.total)}</span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface-muted)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--surface-border)', fontSize: '12px', color: 'var(--brand-500)', fontWeight: 600 }}>
          <span>View all transactions</span>
          <span aria-hidden="true">›</span>
        </div>
      </div>

      {txnModalOpen && monthFilter && (
        <MonthTransactionsModal month={monthFilter} onClose={() => setTxnModalOpen(false)} onChanged={refreshQuietly} />
      )}

      <div style={card}>
        <p style={label}>Monthly Discretionary Trend</p>
        {trendMonths.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No trend data</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '90px' }}>
              {trendMonths.map((m) => {
                const v = monthlyDiscTotals[m]
                const pct = Math.max(2, (v / trendMax) * 100)
                const active = m === monthFilter
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonthFilter(m)}
                    title={`${monthShort(m)} · ${usd(v)}`}
                    style={{
                      flex: 1,
                      height: `${pct}%`,
                      background: active ? 'var(--brand-500)' : '#60a5fa',
                      opacity: active ? 1 : 0.55,
                      borderRadius: '3px 3px 0 0',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      boxShadow: active ? '0 0 0 2px rgba(233,83,43,0.25)' : 'none',
                      transition: 'opacity 0.15s, background-color 0.15s'
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
              <span>{monthShort(trendMonths[0])}</span>
              <span>{monthShort(trendMonths[trendMonths.length - 1])}</span>
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
          <p style={{ ...label, margin: 0 }}>Category Distribution Over Time</p>
          <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>{heatmapMonths.length} months</span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 12px 0' }}>Cell shade = that month's share of the category's own peak. Hover for details.</p>

        {heatmapRows.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No data.</div>
        ) : (() => {
          const gap = 2
          const cellHeight = 22
          return (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 68px', gap: '8px', alignItems: 'center', marginBottom: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
                <span />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{monthShort(heatmapMonths[0])}</span>
                  {heatmapMonths.length > 2 && <span>{monthShort(heatmapMonths[Math.floor(heatmapMonths.length / 2)])}</span>}
                  <span>{monthShort(heatmapMonths[heatmapMonths.length - 1])}</span>
                </div>
                <span style={{ textAlign: 'right' }}>Total</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
                {heatmapRows.map((row, ri) => {
                  const rowColor = HEATMAP_COLORS[ri % HEATMAP_COLORS.length]
                  return (
                    <div key={row.category} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 68px', gap: '8px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: rowColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--tx-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.category}>{row.category}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row.values.length}, 1fr)`, gap: `${gap}px`, height: `${cellHeight}px` }}>
                        {row.values.map((v, ci) => {
                          const intensity = row.rowMax > 0 ? v / row.rowMax : 0
                          const active = heatHover && heatHover.ri === ri && heatHover.ci === ci
                          const isMax = v > 0 && v === row.rowMax
                          const alpha = v > 0 ? 0.18 + 0.72 * intensity : 0
                          return (
                            <div
                              key={ci}
                              onMouseEnter={() => setHeatHover({ ri, ci })}
                              onMouseLeave={() => setHeatHover(null)}
                              onTouchStart={() => setHeatHover({ ri, ci })}
                              title={`${monthShort(heatmapMonths[ci])} · ${row.category} · ${usd(v)}`}
                              style={{
                                background: v > 0 ? hexToRgba(rowColor, alpha) : 'var(--surface-muted)',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                outline: active ? `1.5px solid ${rowColor}` : (isMax ? `1px solid ${hexToRgba(rowColor, 0.65)}` : 'none'),
                                outlineOffset: active ? '1px' : 0,
                                transition: 'outline 0.1s'
                              }}
                            />
                          )
                        })}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--tx-primary)', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{usd(row.total)}</span>
                    </div>
                  )
                })}
              </div>

              {heatHover && (() => {
                const r = heatmapRows[heatHover.ri]
                const m = heatmapMonths[heatHover.ci]
                const v = r.values[heatHover.ci]
                const vs = r.rowAvg > 0 ? ((v - r.rowAvg) / r.rowAvg) * 100 : 0
                return (
                  <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category} · {monthShort(m)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '2px' }}>
                        avg {usd(r.rowAvg)} · peak {usd(r.rowMax)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(v)}</div>
                      {v > 0 && r.rowAvg > 0 && (
                        <div style={{ fontSize: '10px', color: vs >= 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                          {vs >= 0 ? '+' : ''}{vs.toFixed(0)}% vs avg
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
