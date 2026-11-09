import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import SquishSwitch from '../../components/SquishSwitch/SquishSwitch.jsx'
import { CURRENCY, MONEY_LOCALE, moneyCompact } from '../../config.js'

// ---- Live market data ------------------------------------------------------
// Stock values come from the Update Stock Prices workflow (a snapshot every
// weekday). The refresh button only works if a live-prices function is set up.
// CoinGecko needs no key, so Bitcoin is fetched directly.
const COINGECKO_URL = 'https://api.coingecko.com/api/v3'

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function usd(n, opts = {}) {
  if (n == null || isNaN(n)) return '—'
  const digits = opts.digits != null ? opts.digits : 0
  return Number(n).toLocaleString(MONEY_LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function pct(n) {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}
function monthShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function FilterBar({ classFilter, setClassFilter, asOfDate, pendingAsOf, setPendingAsOf, applyFilters, availableDates, card }) {
  const pills = [
    { key: 'all', label: 'All Assets' },
    { key: 'stocks', label: 'Stocks' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'retirement', label: 'Retirement' },
    { key: 'realEstate', label: 'Real Estate' }
  ]
  const pending = pendingAsOf || (asOfDate || '')
  const dirty = (pending || '') !== (asOfDate || '')

  return (
    <div style={{ ...card, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {pills.map((p) => {
            const active = classFilter === p.key
            return (
              <button
                key={p.key}
                onClick={() => setClassFilter(p.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: active ? '1px solid var(--brand-500)' : '1px solid var(--surface-border)',
                  background: active ? 'var(--brand-500)' : 'var(--surface-base)',
                  color: active ? '#fff' : 'var(--tx-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >{p.label}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '11px', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>As of:</span>
          <select
            value={pending}
            onChange={(e) => setPendingAsOf(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: '1px solid var(--surface-border)',
              background: 'var(--surface-base)',
              color: 'var(--tx-primary)',
              fontSize: '12px'
            }}
          >
            <option value="">Current (Latest)</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>
            ))}
          </select>
          <button
            onClick={applyFilters}
            disabled={!dirty}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: dirty ? 'var(--brand-500)' : 'var(--surface-muted)',
              color: dirty ? '#fff' : 'var(--tx-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: dirty ? 'pointer' : 'default'
            }}
          >Apply</button>
        </div>
      </div>
      {asOfDate && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--brand-400)' }}>
          Viewing historical snapshot: {new Date(asOfDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}
    </div>
  )
}

function deriveFromData(scDataAll, reDataAll, asOfDate, livePrices = null) {
  const scData = asOfDate ? scDataAll.filter((r) => r.snapshot_date <= asOfDate) : scDataAll
  const reData = asOfDate ? reDataAll.filter((r) => r.snapshot_date <= asOfDate) : reDataAll

  const latestSc = scData.length > 0 ? scData[scData.length - 1].snapshot_date : null
  const latestRe = reData.length > 0 ? reData[reData.length - 1].snapshot_date : null

  const stocks = []
  let stocksTotal = 0, stocksCost = 0
  const crypto = []
  let cryptoTotal = 0, cryptoCost = 0
  const retirement = []
  let retirementTotal = 0, retirementCost = 0

  const retirementRows = scData.filter((r) => r.asset_type === 'Retirement' || r.asset_type === 'Brokerage')
  const latestRetirementDate = retirementRows.length > 0 ? retirementRows[retirementRows.length - 1].snapshot_date : null

  // Stocks and crypto are snapshotted on their own cadence (retirement now
  // gets a daily row), so use each type's own latest snapshot date rather
  // than the newest date in the whole table.
  const latestByType = {}
  scData.forEach((r) => {
    if (r.asset_type === 'Stock' || r.asset_type === 'Crypto') latestByType[r.asset_type] = r.snapshot_date
  })

  if (latestSc) {
    scData.filter((r) => (r.asset_type === 'Stock' || r.asset_type === 'Crypto') && r.snapshot_date === latestByType[r.asset_type]).forEach((r) => {
      let price = Number(r.price_per_unit) || 0
      let v = Number(r.total_value) || 0
      const qty = Number(r.quantity) || 0
      const cb = Number(r.cost_basis) || 0

      // Override with live prices if available
      if (livePrices && !asOfDate) {
        if (r.asset_type === 'Stock' && livePrices.stocks[r.asset_name]) {
          price = livePrices.stocks[r.asset_name]
          v = qty * price
        } else if (r.asset_type === 'Crypto' && r.asset_name === 'Bitcoin' && livePrices.bitcoin) {
          price = livePrices.bitcoin
          v = qty * price
        }
      }

      const row = { name: r.asset_name, qty, price, value: v, costBasis: cb, gain: v - cb, gainPct: cb > 0 ? ((v - cb) / cb) * 100 : 0 }
      if (r.asset_type === 'Stock') { stocks.push(row); stocksTotal += v; stocksCost += cb }
      else if (r.asset_type === 'Crypto') { crypto.push(row); cryptoTotal += v; cryptoCost += cb }
    })
  }
  if (latestRetirementDate) {
    retirementRows.filter((r) => r.snapshot_date === latestRetirementDate).forEach((r) => {
      const v = Number(r.total_value) || 0
      const cb = Number(r.cost_basis) || 0
      retirement.push({ name: r.asset_name, qty: Number(r.quantity) || 0, price: Number(r.price_per_unit) || 0, value: v, costBasis: cb, gain: v - cb, gainPct: cb > 0 ? ((v - cb) / cb) * 100 : 0 })
      retirementTotal += v
      retirementCost += cb
    })
  }

  const realEstate = []
  let reTotal = 0, reCost = 0
  if (latestRe) {
    // Find latest Zillow and Redfin independently (may be different dates)
    const zillowRows = reData.filter((r) => r.asset_name === 'Condo' && r.data_source === 'Zillow')
    const redfinRows = reData.filter((r) => r.asset_name === 'Condo' && r.data_source === 'Redfin')
    const zillowCondo = zillowRows.length > 0 ? zillowRows[zillowRows.length - 1] : null
    const redfinCondo = redfinRows.length > 0 ? redfinRows[redfinRows.length - 1] : null

    const latestRows = reData.filter((r) => r.snapshot_date === latestRe)
    const storage = latestRows.find((r) => r.asset_name === 'Storage Unit')
    const oldestCondo = reData.find((r) => r.asset_name === 'Condo')
    const initialMortgage = oldestCondo ? (Number(oldestCondo.mortgage_balance) || 0) : 0
    const storageRows = reData.filter((r) => r.asset_name === 'Storage Unit')
    const storageLatest = storageRows.length > 0 ? storageRows[storageRows.length - 1] : null
    if (zillowCondo && redfinCondo) {
      let zVal = Number(zillowCondo.home_value) || 0
      const rVal = Number(redfinCondo.home_value) || 0

      // Override with live Zillow price if available
      if (livePrices && !asOfDate && livePrices.zillow) {
        zVal = livePrices.zillow
      }

      const value = (zVal + rVal) / 2

      // Use most recent mortgage (compare dates)
      const zDate = new Date(zillowCondo.snapshot_date)
      const rDate = new Date(redfinCondo.snapshot_date)
      const mostRecentRow = zDate >= rDate ? zillowCondo : redfinCondo
      const mortgage = Number(mostRecentRow.mortgage_balance || 0)
      const equity = value - mortgage  // Calculate from average value and latest mortgage

      const cb = Number(zillowCondo.cost_basis) || 0
      realEstate.push({ name: 'Condo', value, mortgage, equity, costBasis: cb, gain: value - cb, gainPct: cb > 0 ? ((value - cb) / cb) * 100 : 0, zillow: zVal, redfin: rVal, initialMortgage })
      reTotal += value; reCost += cb
    } else if (zillowCondo || redfinCondo) {
      const row = zillowCondo || redfinCondo
      let value = Number(row.home_value) || 0

      // Override with live Zillow price if available
      if (livePrices && !asOfDate && livePrices.zillow && row.data_source === 'Zillow') {
        value = livePrices.zillow
      }

      const mortgage = Number(row.mortgage_balance || 0)
      const equity = Number(row.net_equity || 0)
      const cb = Number(row.cost_basis) || 0
      realEstate.push({
        name: 'Condo', value, mortgage, equity, costBasis: cb,
        gain: value - cb, gainPct: cb > 0 ? ((value - cb) / cb) * 100 : 0,
        zillow: zillowCondo ? value : null,
        redfin: redfinCondo ? value : null,
        initialMortgage
      })
      reTotal += value; reCost += cb
    }
    const storageSnap = storage || storageLatest
    if (storageSnap) {
      const value = Number(storageSnap.home_value) || 0
      const cb = Number(storageSnap.cost_basis) || 0
      realEstate.push({ name: 'Storage Unit', value, mortgage: 0, equity: value, costBasis: cb, gain: value - cb, gainPct: cb > 0 ? ((value - cb) / cb) * 100 : 0 })
      reTotal += value; reCost += cb
    }
  }

  const total = stocksTotal + cryptoTotal + retirementTotal + reTotal
  const cost = stocksCost + cryptoCost + retirementCost + reCost

  const portfolio = {
    total, cost, gain: total - cost, gainPct: cost > 0 ? ((total - cost) / cost) * 100 : 0,
    asOf: latestSc || latestRe,
    stocks: { rows: stocks, total: stocksTotal, cost: stocksCost, gain: stocksTotal - stocksCost, gainPct: stocksCost > 0 ? ((stocksTotal - stocksCost) / stocksCost) * 100 : 0 },
    crypto: { rows: crypto, total: cryptoTotal, cost: cryptoCost, gain: cryptoTotal - cryptoCost, gainPct: cryptoCost > 0 ? ((cryptoTotal - cryptoCost) / cryptoCost) * 100 : 0 },
    retirement: { rows: retirement, total: retirementTotal, cost: retirementCost, gain: retirementTotal - retirementCost, gainPct: retirementCost > 0 ? ((retirementTotal - retirementCost) / retirementCost) * 100 : 0 },
    realEstate: { rows: realEstate, total: reTotal, cost: reCost, gain: reTotal - reCost, gainPct: reCost > 0 ? ((reTotal - reCost) / reCost) * 100 : 0 }
  }

  const byDate = {}
  scData.forEach((r) => {
    if (!byDate[r.snapshot_date]) byDate[r.snapshot_date] = 0
    byDate[r.snapshot_date] += Number(r.total_value) || 0
  })
  const reByDate = {}
  reData.forEach((r) => {
    if (r.data_source && r.data_source !== 'Zillow' && r.data_source !== 'Redfin') {
      reByDate[r.snapshot_date] = (reByDate[r.snapshot_date] || 0) + Number(r.home_value || 0)
    } else {
      if (!reByDate[r.snapshot_date]) reByDate[r.snapshot_date] = { zillow: 0, redfin: 0, other: 0 }
      if (typeof reByDate[r.snapshot_date] === 'number') return
      if (r.data_source === 'Zillow') reByDate[r.snapshot_date].zillow += Number(r.home_value || 0)
      else if (r.data_source === 'Redfin') reByDate[r.snapshot_date].redfin += Number(r.home_value || 0)
      else reByDate[r.snapshot_date].other += Number(r.home_value || 0)
    }
  })
  const reFlat = {}
  Object.entries(reByDate).forEach(([date, v]) => {
    if (typeof v === 'number') reFlat[date] = v
    else {
      const zil = v.zillow, red = v.redfin
      const avg = zil > 0 && red > 0 ? (zil + red) / 2 : (zil || red || 0)
      reFlat[date] = avg + v.other
    }
  })
  // Snapshots for each asset class land on different dates, so on any given
  // date carry forward the last known value of every holding (and of real
  // estate) instead of summing only the rows that happen to share that date.
  const scGroupDate = {}
  scData.forEach((r) => {
    const key = r.asset_type === 'Retirement' || r.asset_type === 'Brokerage' ? 'Retirement' : r.asset_type
    scGroupDate[r.snapshot_date] = scGroupDate[r.snapshot_date] || {}
    scGroupDate[r.snapshot_date][key] = (scGroupDate[r.snapshot_date][key] || 0) + (Number(r.total_value) || 0)
  })
  const allDates = [...new Set([...Object.keys(byDate), ...Object.keys(reFlat)])].sort()
  const lastGroup = {}
  let lastRe = 0
  const fullHistory = allDates.map((d) => {
    if (scGroupDate[d]) Object.assign(lastGroup, scGroupDate[d])
    if (reFlat[d] != null) lastRe = reFlat[d]
    const scTotal = Object.values(lastGroup).reduce((a, v) => a + v, 0)
    return { date: d, total: scTotal + lastRe }
  })
  const portfolioHistory = fullHistory.slice(-12)

  const condoByDate = {}
  reData.filter((r) => r.asset_name === 'Condo').forEach((r) => {
    const d = r.snapshot_date
    if (!condoByDate[d]) condoByDate[d] = { zillow: [], redfin: [], other: [], mortgage: [] }
    const hv = Number(r.home_value) || 0
    if (r.data_source === 'Zillow') condoByDate[d].zillow.push(hv)
    else if (r.data_source === 'Redfin') condoByDate[d].redfin.push(hv)
    else condoByDate[d].other.push(hv)
    if (r.mortgage_balance != null) condoByDate[d].mortgage.push(Number(r.mortgage_balance) || 0)
  })
  const condoDates = Object.keys(condoByDate).sort().slice(-13)
  const reHistoryDerived = condoDates.map((d) => {
    const b = condoByDate[d]
    const zAvg = b.zillow.length ? b.zillow.reduce((a, v) => a + v, 0) / b.zillow.length : 0
    const rAvg = b.redfin.length ? b.redfin.reduce((a, v) => a + v, 0) / b.redfin.length : 0
    const oAvg = b.other.length ? b.other.reduce((a, v) => a + v, 0) / b.other.length : 0
    const homeValue = zAvg && rAvg ? (zAvg + rAvg) / 2 : (zAvg || rAvg || oAvg)
    const mortgage = b.mortgage.length ? b.mortgage.reduce((a, v) => a + v, 0) / b.mortgage.length : 0
    return { date: d, homeValue, mortgage, equity: homeValue - mortgage }
  })

  return { portfolio, portfolioHistory, reHistoryDerived }
}

export default function InvestmentsTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [portfolioHistory, setPortfolioHistory] = useState([])
  const [reHistory, setReHistory] = useState([])
  const [reModalOpen, setReModalOpen] = useState(false)
  const [reChartHover, setReChartHover] = useState(null)
  const [retirementModalOpen, setRetirementModalOpen] = useState(false)
  const [scHistoryData, setScHistoryData] = useState([])
  const [reHistoryData, setReHistoryData] = useState([])
  const [classFilter, setClassFilter] = useState('all')
  const [asOfDate, setAsOfDate] = useState(null)
  const [pendingAsOf, setPendingAsOf] = useState('')
  const [nwHover, setNwHover] = useState(null)

  function applyFilters() {
    const target = pendingAsOf || null
    setAsOfDate(target)
    const { portfolio: p, portfolioHistory: ph, reHistoryDerived: rh } = deriveFromData(scHistoryData, reHistoryData, target, target ? null : livePrices)
    setPortfolio(p)
    setPortfolioHistory(ph)
    setReHistory(rh)
  }

  // Refresh state
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const [refreshNote, setRefreshNote] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [livePrices, setLivePrices] = useState(null) // Live prices fetched but not written to Supabase

  useEffect(() => { loadAll() }, [])

  // Recompute when live prices change
  useEffect(() => {
    if (livePrices && scHistoryData.length > 0) {
      const { portfolio: p, portfolioHistory: ph, reHistoryDerived: rh } = deriveFromData(scHistoryData, reHistoryData, asOfDate, asOfDate ? null : livePrices)
      setPortfolio(p)
      setPortfolioHistory(ph)
      setReHistory(rh)
    }
  }, [livePrices])

  async function loadAll(silent) {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [scAll, reAll] = await Promise.all([
        supabase.from('stocks_crypto_history').select('*').order('snapshot_date', { ascending: true }),
        supabase.from('real_estate_history').select('*').order('snapshot_date', { ascending: true })
      ])
      if (scAll.error) throw scAll.error
      if (reAll.error) throw reAll.error

      const scData = scAll.data || []
      const reData = reAll.data || []
      setScHistoryData(scData)
      setReHistoryData(reData)

      const { portfolio: p, portfolioHistory: ph, reHistoryDerived: rh } = deriveFromData(scData, reData, null, livePrices)
      setPortfolio(p)
      setPortfolioHistory(ph)
      setReHistory(rh)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // ---- Refresh: pull live prices (display only, does NOT write to Supabase) --
  async function refreshPrices() {
    setRefreshing(true)
    setRefreshError(null)
    setRefreshNote(null)

    try {
      // 1. Stocks and home value via the live-prices Edge Function
      const symbols = [...new Set(scHistoryData.filter((r) => r.asset_type === 'Stock').map((r) => r.asset_name))]
      const { data: lp, error: lpErr } = await supabase.functions.invoke('live-prices', { body: { symbols } })
      if (lpErr) {
        // Live refresh isn't set up in this copy; the Update Stock Prices workflow
        // saves fresh prices every weekday instead.
        setRefreshNote('Prices update by themselves every weekday evening.')
        return
      }
      const stocks = (lp && lp.stocks) || {}
      for (const sym of symbols) if (!stocks[sym]) throw new Error(`No price for ${sym}: ${(lp && lp.stockErrors && lp.stockErrors[sym]) || 'unknown reason'}`)

      // 2. Crypto via CoinGecko
      const cgRes = await fetch(`${COINGECKO_URL}/simple/price?ids=bitcoin&vs_currencies=usd`)
      if (!cgRes.ok) throw new Error(`CoinGecko failed (${cgRes.status})`)
      const cg = await cgRes.json()
      const btcPrice = Number(cg && cg.bitcoin && cg.bitcoin.usd)
      if (!btcPrice) throw new Error('No Bitcoin price returned')

      // 3. Zillow property value (best effort, from the same Edge Function call)
      const zillowValue = lp && lp.zillow ? Number(lp.zillow) : null
      if (!zillowValue) setRefreshNote(`Zillow was skipped (${(lp && lp.zillowError) || 'no value'}); using last known value.`)

      // Store live prices in state (NOT written to Supabase)
      setLivePrices({ stocks, bitcoin: btcPrice, zillow: zillowValue })
      setLastUpdated(new Date())
    } catch (err) {
      setRefreshError(err.message || String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }
  const label = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 10px 0' }

  if (loading) return <div className="status-block">Loading investments...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>
  if (!portfolio) return <div className="status-block">No portfolio data.</div>

  const gainColor = (v) => (v >= 0 ? '#10b981' : '#ef4444')

  const historyMax = Math.max(1, ...portfolioHistory.map((r) => r.total))
  const historyMin = Math.min(...portfolioHistory.map((r) => r.total), historyMax)
  const range = Math.max(1, historyMax - historyMin)

  const classes = [
    { key: 'stocks', label: 'Stocks', data: portfolio.stocks, color: '#60a5fa' },
    { key: 'crypto', label: 'Crypto', data: portfolio.crypto, color: '#fbbf24' },
    { key: 'retirement', label: 'Retirement', data: portfolio.retirement, color: '#fb923c' },
    { key: 'realEstate', label: 'Real Estate', data: portfolio.realEstate, color: '#a78bfa' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
        </span>
        <button
          onClick={refreshPrices}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--brand-500)',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: refreshing ? 'default' : 'pointer',
            opacity: refreshing ? 0.6 : 1
          }}
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh Prices'}
        </button>
      </div>

      {refreshNote && (
        <div style={{ fontSize: '12px', color: '#f59e0b', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '10px', padding: '10px 12px' }}>
          {refreshNote}
        </div>
      )}
      {refreshError && (
        <div className="status-block error" style={{ fontSize: '12px' }}>Refresh failed: {refreshError}</div>
      )}

      <div style={card}>
        <p style={label}>Total Net Worth {portfolio.asOf ? `· ${new Date(portfolio.asOf + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
        <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{usd(portfolio.total)}</p>
        <p style={{ fontSize: '12px', color: gainColor(portfolio.gain), margin: '6px 0 0 0', fontWeight: 600 }}>
          {portfolio.gain >= 0 ? '+' : ''}{usd(portfolio.gain)} ({pct(portfolio.gainPct)}) vs cost basis
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {classes.map((c) => {
          const clickable = c.key === 'realEstate' || c.key === 'retirement'
          const dim = classFilter !== 'all' && classFilter !== c.key
          const handleClick = c.key === 'realEstate'
            ? () => setReModalOpen(true)
            : c.key === 'retirement'
              ? () => setRetirementModalOpen(true)
              : undefined
          const commonInner = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ ...label, margin: 0 }}>{c.label}</span>
                </div>
                {clickable && <span style={{ fontSize: '11px', color: 'var(--brand-400)', fontWeight: 700 }}>›</span>}
              </div>
              <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{usd(c.data.total)}</p>
              <p style={{ fontSize: '11px', color: gainColor(c.data.gain), margin: '4px 0 0 0', fontWeight: 600 }}>{c.data.gain >= 0 ? '+' : ''}{usd(c.data.gain)} ({pct(c.data.gainPct)})</p>
            </>
          )
          const baseStyle = { ...card, opacity: dim ? 0.4 : 1, transition: 'opacity 0.15s' }
          return clickable ? (
            <button
              key={c.key}
              type="button"
              onClick={handleClick}
              style={{ ...baseStyle, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', width: '100%' }}
            >
              {commonInner}
            </button>
          ) : (
            <div key={c.key} style={baseStyle}>{commonInner}</div>
          )
        })}
      </div>

      {reModalOpen && (
        <RealEstateModal
          onClose={() => setReModalOpen(false)}
          portfolio={portfolio}
          reHistory={reHistory}
          hover={reChartHover}
          setHover={setReChartHover}
        />
      )}
      {retirementModalOpen && (
        <RetirementModal
          onClose={() => setRetirementModalOpen(false)}
          balance={portfolio.retirement.total}
        />
      )}

      <FilterBar
        classFilter={classFilter}
        setClassFilter={setClassFilter}
        asOfDate={asOfDate}
        pendingAsOf={pendingAsOf}
        setPendingAsOf={setPendingAsOf}
        applyFilters={applyFilters}
        availableDates={[...new Set([...scHistoryData.map((r) => r.snapshot_date), ...reHistoryData.map((r) => r.snapshot_date)])].sort().reverse()}
        card={card}
      />

      <div style={card}>
        <p style={label}>12-Month Net Worth Trend</p>
        {portfolioHistory.length < 2 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>Need at least 2 snapshots</div>
        ) : (() => {
          const yFor = (v) => 110 - ((v - historyMin) / range) * 90 - 10
          const xFor = (i) => (i / (portfolioHistory.length - 1)) * 1000
          return (
            <>
              <div style={{ width: '100%', height: '120px', position: 'relative' }}>
                <svg
                  width="100%"
                  height="120"
                  viewBox="0 0 1000 120"
                  preserveAspectRatio="none"
                  onMouseLeave={() => setNwHover(null)}
                  style={{ overflow: 'visible' }}
                >
                  <path
                    d={portfolioHistory.map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(r.total)}`).join(' ')}
                    stroke="var(--brand-500)"
                    strokeWidth="2"
                    fill="none"
                  />
                  {portfolioHistory.map((r, i) => {
                    const active = nwHover === i
                    return (
                      <circle
                        key={`pt-${i}`}
                        cx={xFor(i)}
                        cy={yFor(r.total)}
                        r={active ? 5 : 3}
                        fill="var(--brand-500)"
                        stroke={active ? 'var(--surface-base)' : 'none'}
                        strokeWidth={active ? 2 : 0}
                      />
                    )
                  })}
                  {portfolioHistory.map((r, i) => {
                    const w = 1000 / Math.max(1, portfolioHistory.length)
                    return (
                      <rect
                        key={`hit-${i}`}
                        x={xFor(i) - w / 2}
                        y={0}
                        width={w}
                        height={120}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setNwHover(i)}
                        onTouchStart={() => setNwHover(i)}
                      />
                    )
                  })}
                </svg>
                {nwHover !== null && portfolioHistory[nwHover] && (() => {
                  const r = portfolioHistory[nwHover]
                  const leftPct = (nwHover / Math.max(1, portfolioHistory.length - 1)) * 100
                  const topPct = (yFor(r.total) / 120) * 100
                  const flipLeft = leftPct > 70
                  const flipUp = topPct < 30
                  const prev = nwHover > 0 ? portfolioHistory[nwHover - 1] : null
                  const delta = prev ? r.total - prev.total : 0
                  const deltaPct = prev && prev.total > 0 ? (delta / prev.total) * 100 : 0
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
                      <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                        {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ color: 'var(--brand-400)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{usd(r.total)}</div>
                      {prev && (
                        <div style={{ fontSize: '10px', color: delta >= 0 ? '#22c55e' : '#ef4444', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                          {delta >= 0 ? '▲' : '▼'} {usd(Math.abs(delta))} ({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
                <span>{monthShort(portfolioHistory[0].date)} · {usd(portfolioHistory[0].total)}</span>
                <span>{monthShort(portfolioHistory[portfolioHistory.length - 1].date)} · {usd(portfolioHistory[portfolioHistory.length - 1].total)}</span>
              </div>
            </>
          )
        })()}
      </div>

      <HoldingsTable portfolio={portfolio} card={card} label={label} classFilter={classFilter} />


      <PortfolioSunburst portfolio={portfolio} card={card} label={label} classFilter={classFilter} />
      <PerformanceLadder portfolio={portfolio} card={card} label={label} classFilter={classFilter} />
      <PortfolioHeartbeat scData={scHistoryData} reData={reHistoryData} portfolio={portfolio} card={card} label={label} classFilter={classFilter} asOfDate={asOfDate} />
      <ContributionWaterfall portfolio={portfolio} card={card} label={label} classFilter={classFilter} />
      <ValueJourneyRibbon scData={scHistoryData} reData={reHistoryData} card={card} label={label} classFilter={classFilter} asOfDate={asOfDate} />

    </div>
  )
}

function usdK(n) {
  if (n == null || isNaN(n)) return ''
  return moneyCompact(n)
}

function RealEstateModal({ onClose, portfolio, reHistory, hover, setHover }) {
  const condo = portfolio.realEstate.rows.find((r) => r.name === 'Condo')
  if (!condo) return null

  const zVal = condo.zillow
  const rVal = condo.redfin
  const avg = condo.value
  const hasBoth = zVal != null && rVal != null && zVal > 0 && rVal > 0
  const difference = hasBoth ? Math.abs(zVal - rVal) : 0
  const variance = hasBoth ? (difference / Math.min(zVal, rVal)) * 100 : 0
  const initialMortgage = Number(condo.initialMortgage) || 0
  const downPayment = Math.max(0, (Number(condo.costBasis) || 0) - initialMortgage)
  const principalPaid = Math.max(0, initialMortgage - condo.mortgage)
  const appreciation = condo.value - condo.costBasis
  const appreciationPct = condo.costBasis > 0 ? (appreciation / condo.costBasis) * 100 : 0

  const card = { backgroundColor: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '14px' }
  const label = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 10px 0' }

  const bigStat = (bg, borderColor, textColor, subLabel, value) => (
    <div style={{ flex: 1, minWidth: 0, background: bg, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '14px 10px', overflow: 'hidden' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: textColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{subLabel}</div>
      <div style={{ fontSize: 'clamp(0.95rem, 3.6vw, 1.4rem)', fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )

  const miniStat = (title, value, valueColor, bg, border) => (
    <div style={{ flex: 1, minWidth: 0, background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '10px 8px', textAlign: 'center', overflow: 'hidden' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: 'clamp(0.8rem, 3vw, 1rem)', fontWeight: 700, color: valueColor, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )

  // Chart geometry
  const w = 1000, h = 200
  const pad = { top: 12, right: 12, bottom: 24, left: 48 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const has = reHistory.length >= 2
  const maxV = has ? Math.max(...reHistory.map((r) => r.homeValue)) : 0
  const minV = has ? Math.min(...reHistory.map((r) => r.mortgage)) : 0
  const yTop = Math.ceil(maxV / 200000) * 200000
  const yBot = Math.floor(minV / 200000) * 200000
  const yRange = Math.max(1, yTop - yBot)
  const yTicks = []
  for (let v = yBot; v <= yTop; v += 200000) yTicks.push(v)
  const xFor = (i) => pad.left + (i / Math.max(1, reHistory.length - 1)) * innerW
  const yFor = (v) => pad.top + innerH - ((v - yBot) / yRange) * innerH

  const seriesMeta = [
    { key: 'homeValue', label: 'Home Value', color: '#a78bfa' },
    { key: 'equity', label: 'Net Equity', color: '#22c55e' },
    { key: 'mortgage', label: 'Mortgage Balance', color: '#ef4444' }
  ]

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '16px', padding: '18px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid var(--surface-border)', marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)' }}>Real Estate Breakdown</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}
          >×</button>
        </div>

        <div style={{ ...card, marginBottom: '14px' }}>
          <p style={label}>🏙️ Property Value Estimates</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {miniStat('Zillow Zestimate', zVal != null ? usd(zVal) : '—', '#22d3ee', 'var(--surface-raised)', 'var(--surface-border)')}
            {miniStat('Redfin Estimate', rVal != null ? usd(rVal) : '—', '#fb923c', 'var(--surface-raised)', 'var(--surface-border)')}
            {miniStat('Average (Used)', usd(avg), '#fff', 'rgba(167,139,250,0.85)', 'rgba(167,139,250,1)')}
          </div>
          {hasBoth && (
            <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', fontSize: '12px', color: 'var(--tx-secondary)', textAlign: 'center' }}>
              <b style={{ color: 'var(--tx-primary)' }}>Difference:</b> {usd(difference)} ({variance.toFixed(1)}% variance)
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {bigStat('rgba(167,139,250,0.9)', 'rgba(167,139,250,1)', 'rgba(255,255,255,0.9)', 'Home Value (Avg)', usd(avg))}
          {bigStat('rgba(239,68,68,0.9)', 'rgba(239,68,68,1)', 'rgba(255,255,255,0.9)', 'Mortgage Balance', `-${usd(condo.mortgage)}`)}
          {bigStat('rgba(34,197,94,0.9)', 'rgba(34,197,94,1)', 'rgba(255,255,255,0.9)', 'Net Equity', usd(condo.equity))}
        </div>

        <div style={{ ...card, marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: '18px', rowGap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--tx-muted)' }}>Purchase Price:</span>
            <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(condo.costBasis)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--tx-muted)' }}>Appreciation:</span>
            <span style={{ color: appreciation >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{appreciation >= 0 ? '+' : ''}{usd(appreciation)} ({pct(appreciationPct)})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--tx-muted)' }}>Down Payment:</span>
            <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(downPayment)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--tx-muted)' }}>Principal Paid:</span>
            <span style={{ color: '#22c55e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(principalPaid)}</span>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ ...label, margin: 0 }}>13-Month Equity Trend</p>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>{reHistory.length} pts</span>
          </div>
          {!has ? (
            <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>Need at least 2 monthly snapshots.</div>
          ) : (
            <div style={{ position: 'relative' }}>
              <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '240px' }} onMouseLeave={() => setHover(null)}>
                {yTicks.map((tv) => (
                  <g key={tv}>
                    <line x1={pad.left} x2={w - pad.right} y1={yFor(tv)} y2={yFor(tv)} stroke="var(--surface-border)" strokeDasharray="3 4" />
                    <text x={pad.left - 6} y={yFor(tv) + 3} fill="var(--tx-muted)" fontSize="10" textAnchor="end">{usdK(tv)}</text>
                  </g>
                ))}
                {seriesMeta.map((s) => (
                  <g key={s.key}>
                    <path
                      d={reHistory.map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(r[s.key])}`).join(' ')}
                      stroke={s.color}
                      strokeWidth="2"
                      fill="none"
                    />
                    {reHistory.map((r, i) => (
                      <circle key={`${s.key}-${i}`} cx={xFor(i)} cy={yFor(r[s.key])} r={hover === i ? 4 : 2.5} fill={s.color} />
                    ))}
                  </g>
                ))}
                {reHistory.map((r, i) => (
                  <rect
                    key={`hit-${i}`}
                    x={xFor(i) - innerW / Math.max(1, reHistory.length * 2)}
                    y={pad.top}
                    width={innerW / Math.max(1, reHistory.length)}
                    height={innerH}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(i)}
                    onTouchStart={() => setHover(i)}
                  />
                ))}
                {reHistory.map((r, i) => (
                  <text
                    key={`xl-${i}`}
                    x={xFor(i)}
                    y={h - 6}
                    fontSize="10"
                    fill="var(--tx-muted)"
                    textAnchor="middle"
                    style={{ display: (i === 0 || i === reHistory.length - 1 || i % 2 === 0) ? 'block' : 'none' }}
                  >
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '")}
                  </text>
                ))}
              </svg>
              {hover != null && reHistory[hover] && (
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '10px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '11px',
                    color: 'var(--tx-primary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>{new Date(reHistory[hover].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                  <div style={{ color: '#a78bfa' }}>Value: {usd(reHistory[hover].homeValue)}</div>
                  <div style={{ color: '#22c55e' }}>Equity: {usd(reHistory[hover].equity)}</div>
                  <div style={{ color: '#ef4444' }}>Mortgage: {usd(reHistory[hover].mortgage)}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '4px', fontSize: '11px' }}>
                {seriesMeta.map((s) => (
                  <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--tx-secondary)' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const STOCK_NAMES = { AAPL: 'Apple Inc.', NVDA: 'Nvidia Corp.', TSLA: 'Tesla Inc.' }
const TYPE_STYLES = {
  Stock: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  Crypto: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  'Real Estate': { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: 'rgba(167,139,250,0.35)' }
}

function TypePill({ type }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.Stock
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '999px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap'
    }}>{type}</span>
  )
}

function HoldingsTable({ portfolio, card, label, classFilter = 'all' }) {
  const allow = (k) => classFilter === 'all' || classFilter === k
  const rows = []
  if (allow('stocks')) portfolio.stocks.rows.forEach((r) => rows.push({
    type: 'Stock', name: r.name, subtitle: STOCK_NAMES[r.name] || 'Equity',
    qty: r.qty, qtyDisplay: r.qty.toLocaleString('en-US', { maximumFractionDigits: 4 }),
    price: r.price, value: r.value, costBasis: r.costBasis, gain: r.gain, gainPct: r.gainPct
  }))
  if (allow('crypto')) portfolio.crypto.rows.forEach((r) => rows.push({
    type: 'Crypto', name: r.name, subtitle: `${r.qty.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${r.name === 'Bitcoin' ? 'BTC' : ''}`.trim(),
    qty: r.qty, qtyDisplay: r.qty.toLocaleString('en-US', { maximumFractionDigits: 5 }),
    price: r.price, value: r.value, costBasis: r.costBasis, gain: r.gain, gainPct: r.gainPct
  }))
  if (allow('realEstate')) portfolio.realEstate.rows.forEach((r) => rows.push({
    type: 'Real Estate', name: r.name, subtitle: r.name === 'Condo' ? 'Primary residence' : 'Owned outright',
    qty: 1, qtyDisplay: '1',
    price: r.value, value: r.value, costBasis: r.costBasis, gain: r.gain, gainPct: r.gainPct
  }))

  const header = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }
  const headerRight = { ...header, textAlign: 'right' }
  const cell = { fontSize: '13px', color: 'var(--tx-primary)', padding: '12px 8px', borderTop: '1px solid var(--surface-border)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
  const cellRight = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p style={{ ...label, margin: 0 }}>Holdings</p>
        <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>{rows.length} assets</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No holdings</div>
      ) : (
        <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '760px' }}>
            <thead>
              <tr>
                <th style={header}>Asset</th>
                <th style={header}>Type</th>
                <th style={headerRight}>Quantity</th>
                <th style={headerRight}>Price</th>
                <th style={headerRight}>Total Value</th>
                <th style={headerRight}>Cost Basis</th>
                <th style={headerRight}>Gain/Loss</th>
                <th style={headerRight}>% Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gc = r.gain >= 0 ? '#22c55e' : '#ef4444'
                return (
                  <tr key={`${r.type}-${r.name}`}>
                    <td style={cell}>
                      <div style={{ fontWeight: 700 }}>{r.name}</div>
                      {r.subtitle && <div style={{ fontSize: '11px', color: 'var(--tx-muted)', fontWeight: 400, marginTop: '2px' }}>{r.subtitle}</div>}
                    </td>
                    <td style={cell}><TypePill type={r.type} /></td>
                    <td style={cellRight}>{r.qtyDisplay}</td>
                    <td style={cellRight}>{usd(r.price, { digits: r.type === 'Crypto' ? 0 : 2 })}</td>
                    <td style={cellRight}>{usd(r.value)}</td>
                    <td style={cellRight}>{usd(r.costBasis)}</td>
                    <td style={{ ...cellRight, color: gc, fontWeight: 600 }}>{r.gain >= 0 ? '+' : ''}{usd(r.gain)}</td>
                    <td style={{ ...cellRight, color: gc, fontWeight: 600 }}>{pct(r.gainPct)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PortfolioHeartbeat({ scData, reData, portfolio, card, label, classFilter = 'all', asOfDate = null }) {
  const [hover, setHover] = useState(null)
  const allow = (k) => classFilter === 'all' || classFilter === k
  const CLS_KEY = { Stock: 'stocks', Crypto: 'crypto', Retirement: 'retirement', Brokerage: 'retirement', 'Real Estate': 'realEstate' }

  const CLASS_COLORS = { Stock: '#60a5fa', Crypto: '#fbbf24', Retirement: '#fb923c', Brokerage: '#fb923c', 'Real Estate': '#a78bfa' }
  const scFiltered = asOfDate ? scData.filter((r) => r.snapshot_date <= asOfDate) : scData
  const reFiltered = asOfDate ? reData.filter((r) => r.snapshot_date <= asOfDate) : reData

  const timelines = []
  const scByAsset = {}
  scFiltered.forEach((r) => {
    const key = r.asset_name
    if (!scByAsset[key]) scByAsset[key] = { name: key, cls: r.asset_type === 'Brokerage' ? 'Retirement' : r.asset_type, history: [] }
    scByAsset[key].history.push({ date: r.snapshot_date, value: Number(r.total_value) || 0 })
  })
  Object.values(scByAsset).forEach((t) => {
    t.history.sort((a, b) => a.date.localeCompare(b.date))
    if (t.history.length > 0) timelines.push(t)
  })

  const reByAsset = {}
  reFiltered.forEach((r) => {
    const name = r.asset_name
    const d = r.snapshot_date
    if (!reByAsset[name]) reByAsset[name] = { name, cls: 'Real Estate', byDate: {} }
    if (!reByAsset[name].byDate[d]) reByAsset[name].byDate[d] = { z: [], rd: [], o: [] }
    const hv = Number(r.home_value) || 0
    if (r.data_source === 'Zillow') reByAsset[name].byDate[d].z.push(hv)
    else if (r.data_source === 'Redfin') reByAsset[name].byDate[d].rd.push(hv)
    else reByAsset[name].byDate[d].o.push(hv)
  })
  Object.values(reByAsset).forEach((a) => {
    const dates = Object.keys(a.byDate).sort()
    const history = dates.map((d) => {
      const b = a.byDate[d]
      const zAvg = b.z.length ? b.z.reduce((s, v) => s + v, 0) / b.z.length : 0
      const rAvg = b.rd.length ? b.rd.reduce((s, v) => s + v, 0) / b.rd.length : 0
      const oAvg = b.o.length ? b.o.reduce((s, v) => s + v, 0) / b.o.length : 0
      const value = zAvg && rAvg ? (zAvg + rAvg) / 2 : (zAvg || rAvg || oAvg)
      return { date: d, value }
    })
    if (history.length > 0) timelines.push({ name: a.name, cls: a.cls, history })
  })

  const filteredTimelines = timelines.filter((t) => allow(CLS_KEY[t.cls] || 'all'))
  filteredTimelines.sort((a, b) => {
    const av = a.history[a.history.length - 1]?.value || 0
    const bv = b.history[b.history.length - 1]?.value || 0
    return bv - av
  })

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <p style={{ ...label, margin: 0 }}>Portfolio Heartbeat</p>
        <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Recent trajectory per holding</span>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 12px 0' }}>Each spark is one asset's value over its snapshots. Green rising, red falling.</p>
      {filteredTimelines.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No history yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {filteredTimelines.map((t, ti) => {
            const h = t.history.slice(-14)
            const min = Math.min(...h.map((p) => p.value))
            const max = Math.max(...h.map((p) => p.value))
            const range = Math.max(1, max - min)
            const first = h[0].value
            const last = h[h.length - 1].value
            const delta = last - first
            const deltaPct = first > 0 ? (delta / first) * 100 : 0
            const trendColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : 'var(--tx-muted)'
            const areaTrend = `rgba(${delta >= 0 ? '34,197,94' : '239,68,68'}, 0.16)`
            const active = hover === ti
            return (
              <div
                key={t.name}
                onMouseEnter={() => setHover(ti)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(ti)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--surface-base)',
                  border: `1px solid ${active ? trendColor : 'var(--surface-border)'}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.12s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CLASS_COLORS[t.cls] || '#94a3b8', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--tx-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>{t.name}</span>
                </div>
                <div style={{ width: '100%', height: '36px' }}>
                  <svg width="100%" height="36" viewBox="0 0 100 36" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <defs>
                      <linearGradient id={`hb-${ti}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={trendColor} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M 0 36 ${h.map((p, i) => `L ${(i / Math.max(1, h.length - 1)) * 100} ${32 - ((p.value - min) / range) * 28}`).join(' ')} L 100 36 Z`}
                      fill={`url(#hb-${ti})`}
                    />
                    <path
                      d={h.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / Math.max(1, h.length - 1)) * 100} ${32 - ((p.value - min) / range) * 28}`).join(' ')}
                      stroke={trendColor}
                      strokeWidth="1.5"
                      fill="none"
                    />
                    <circle cx={100} cy={32 - ((last - min) / range) * 28} r="2" fill={trendColor} />
                  </svg>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(last)}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: trendColor, fontVariantNumeric: 'tabular-nums' }}>
                    {delta >= 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ContributionWaterfall({ portfolio, card, label, classFilter = 'all' }) {
  const [hover, setHover] = useState(null)
  const allow = (k) => classFilter === 'all' || classFilter === k

  const items = []
  const add = (cls, color, rows) => rows.forEach((r) => items.push({ name: r.name, cls, color, gain: r.gain || 0, value: r.value }))
  if (allow('stocks')) add('Stock', '#60a5fa', portfolio.stocks.rows)
  if (allow('crypto')) add('Crypto', '#fbbf24', portfolio.crypto.rows)
  const retRows = portfolio.retirement.rows.length > 0 ? portfolio.retirement.rows : [{ name: '401(k)', gain: portfolio.retirement.gain, value: portfolio.retirement.total }]
  if (allow('retirement')) add('Retirement', '#fb923c', retRows)
  if (allow('realEstate')) add('Real Estate', '#a78bfa', portfolio.realEstate.rows)

  const positives = items.filter((i) => i.gain > 0).sort((a, b) => b.gain - a.gain)
  const negatives = items.filter((i) => i.gain < 0).sort((a, b) => a.gain - b.gain)
  const ordered = [...positives, ...negatives]
  const totalGain = items.reduce((s, i) => s + i.gain, 0)

  let running = 0
  const steps = ordered.map((it) => {
    const start = running
    const end = running + it.gain
    running = end
    return { ...it, start, end }
  })
  const totalStep = { name: 'Net Total', cls: 'Total', color: totalGain >= 0 ? '#22c55e' : '#ef4444', gain: totalGain, start: 0, end: totalGain, isTotal: true }
  const all = [...steps, totalStep]

  const maxY = Math.max(0, ...all.map((s) => Math.max(s.start, s.end)))
  const minY = Math.min(0, ...all.map((s) => Math.min(s.start, s.end)))
  const yRange = Math.max(1, maxY - minY)

  const w = 1000, h = 220
  const pad = { top: 12, right: 12, bottom: 44, left: 12 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const barW = innerW / all.length * 0.72
  const gapW = innerW / all.length
  const xFor = (i) => pad.left + gapW * i + (gapW - barW) / 2
  const yFor = (v) => pad.top + innerH - ((v - minY) / yRange) * innerH
  const zeroY = yFor(0)

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <p style={{ ...label, margin: 0 }}>Gain Contribution</p>
        <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>How each asset stacks into your total P&amp;L</span>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 10px 0' }}>Bars step up on winners, down on losers, ending at Net Total.</p>
      {ordered.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No holdings.</div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', height: '260px' }} onMouseLeave={() => setHover(null)}>
            <line x1={pad.left} x2={w - pad.right} y1={zeroY} y2={zeroY} stroke="var(--surface-border)" strokeDasharray="4 4" />
            {all.map((s, i) => {
              const barX = xFor(i)
              const barY = Math.min(yFor(s.start), yFor(s.end))
              const barH = Math.abs(yFor(s.start) - yFor(s.end)) || 2
              const isPos = s.gain >= 0
              const barColor = s.isTotal
                ? (isPos ? '#22c55e' : '#ef4444')
                : (isPos ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)')
              const nextX = i < all.length - 1 ? xFor(i + 1) : null
              const connectorY = yFor(s.end)
              const active = hover === i
              return (
                <g key={i}>
                  {nextX != null && !s.isTotal && (
                    <line x1={barX + barW} x2={nextX} y1={connectorY} y2={connectorY} stroke="var(--surface-border)" strokeDasharray="2 3" />
                  )}
                  <rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={barH}
                    fill={barColor}
                    stroke={s.isTotal ? 'var(--surface-raised)' : 'transparent'}
                    strokeWidth={s.isTotal ? 2 : 0}
                    rx="3"
                    style={{ cursor: 'pointer', filter: active ? 'brightness(1.15)' : 'none' }}
                    onMouseEnter={() => setHover(i)}
                    onTouchStart={() => setHover(i)}
                  />
                  <text
                    x={barX + barW / 2}
                    y={h - 26}
                    fontSize="10"
                    fill={s.isTotal ? 'var(--tx-primary)' : 'var(--tx-secondary)'}
                    fontWeight={s.isTotal ? 700 : 500}
                    textAnchor="middle"
                  >
                    {s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name}
                  </text>
                  <text
                    x={barX + barW / 2}
                    y={h - 12}
                    fontSize="9"
                    fill={isPos ? '#22c55e' : '#ef4444'}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {isPos ? '+' : ''}{Math.round(s.gain / 1000)}k
                  </text>
                </g>
              )
            })}
          </svg>
          {hover != null && all[hover] && (
            <div style={{
              position: 'absolute', top: '4px', right: '10px',
              background: 'var(--surface-raised)', border: '1px solid var(--surface-border)',
              borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: 'var(--tx-primary)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>{all[hover].name}</div>
              <div style={{ color: all[hover].gain >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {all[hover].gain >= 0 ? '+' : ''}{usd(all[hover].gain)}
              </div>
              {!all[hover].isTotal && (
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Running: {all[hover].end >= 0 ? '+' : ''}{usd(all[hover].end)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ValueJourneyRibbon({ scData: scAll, reData: reAll, card, label, classFilter = 'all', asOfDate = null }) {
  const [hover, setHover] = useState(null)
  const [mode, setMode] = useState('percent')
  const allow = (k) => classFilter === 'all' || classFilter === k
  const scData = asOfDate ? scAll.filter((r) => r.snapshot_date <= asOfDate) : scAll
  const reData = asOfDate ? reAll.filter((r) => r.snapshot_date <= asOfDate) : reAll

  const classify = (r) => {
    if (r.asset_type === 'Stock') return 'stocks'
    if (r.asset_type === 'Crypto') return 'crypto'
    if (r.asset_type === 'Retirement' || r.asset_type === 'Brokerage') return 'retirement'
    return null
  }

  const byDate = {}
  scData.forEach((r) => {
    const cls = classify(r)
    if (!cls) return
    if (!byDate[r.snapshot_date]) byDate[r.snapshot_date] = { stocks: 0, crypto: 0, retirement: 0 }
    byDate[r.snapshot_date][cls] += Number(r.total_value) || 0
  })

  const dates = Object.keys(byDate).sort()
  if (dates.length < 2) {
    return (
      <div style={card}>
        <p style={{ ...label, margin: 0 }}>Liquid Portfolio Journey</p>
        <p style={{ fontSize: '13px', color: 'var(--tx-muted)', marginTop: '8px' }}>Need at least 2 snapshots to draw the ribbon.</p>
      </div>
    )
  }
  const rows = dates.map((d) => ({ date: d, ...byDate[d] }))

  const layers = [
    { key: 'retirement', label: 'Retirement', color: '#fb923c' },
    { key: 'stocks', label: 'Stocks', color: '#60a5fa' },
    { key: 'crypto', label: 'Crypto', color: '#fbbf24' }
  ].filter((L) => allow(L.key))
  if (layers.length === 0) {
    return (
      <div style={card}>
        <p style={{ ...label, margin: 0 }}>Liquid Portfolio Journey</p>
        <p style={{ fontSize: '13px', color: 'var(--tx-muted)', marginTop: '8px' }}>{classFilter === 'realEstate' ? 'Real Estate is charted in its own modal above.' : 'No layers to show for the current filter.'}</p>
      </div>
    )
  }

  const w = 1000, h = 220
  const pad = { top: 12, right: 12, bottom: 26, left: 52 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const maxTotal = Math.max(1, ...rows.map((r) => layers.reduce((s, L) => s + (r[L.key] || 0), 0)))
  const xFor = (i) => pad.left + (i / Math.max(1, rows.length - 1)) * innerW
  const yFor = (v) => pad.top + innerH - (v / maxTotal) * innerH
  const percentYFor = (v) => pad.top + innerH - v * innerH

  const cumRows = rows.map((r) => {
    const total = layers.reduce((s, L) => s + (r[L.key] || 0), 0)
    let accAbs = 0, accPct = 0
    const out = { date: r.date, layers: {}, total }
    layers.forEach((L) => {
      const v = r[L.key] || 0
      const share = total > 0 ? v / total : 0
      out.layers[L.key] = {
        start: accAbs, end: accAbs + v,
        pStart: accPct, pEnd: accPct + share,
        value: v, share
      }
      accAbs += v
      accPct += share
    })
    return out
  })
  const posFor = (layer, key) => mode === 'percent' ? percentYFor(layer[key === 'start' ? 'pStart' : 'pEnd']) : yFor(layer[key])

  const yTicks = []
  if (mode === 'percent') {
    ;[0, 0.25, 0.5, 0.75, 1].forEach((p) => yTicks.push({ v: p, label: `${Math.round(p * 100)}%` }))
  } else {
    const step = maxTotal > 200000 ? 200000 : maxTotal > 50000 ? 50000 : 10000
    for (let v = 0; v <= maxTotal; v += step) yTicks.push({ v, label: usdK(v) })
  }

  const active = hover != null ? cumRows[hover] : null

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
        <p style={{ ...label, margin: 0 }}>Liquid Portfolio Journey</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
          <span style={{ color: mode === 'percent' ? 'var(--tx-primary)' : 'var(--tx-muted)' }}>% Share</span>
          <SquishSwitch
            checked={mode === 'dollar'}
            onChange={(v) => setMode(v ? 'dollar' : 'percent')}
            ariaLabel="Toggle between percent share and dollar value"
            width={52}
            height={28}
            trackColor="rgba(255,255,255,0.08)"
            trackOnColor="var(--brand-500)"
          />
          <span style={{ color: mode === 'dollar' ? 'var(--tx-primary)' : 'var(--tx-muted)' }}>$ Value</span>
        </div>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 10px 0' }}>
        Retirement, Stocks &amp; Crypto over time. Real Estate lives in its own modal above.
        {mode === 'percent' ? ' Each snapshot fills 100%.' : ' Absolute-value stack.'}
      </p>
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '240px' }} onMouseLeave={() => setHover(null)}>
          {yTicks.map((t) => {
            const yPos = mode === 'percent' ? percentYFor(t.v) : yFor(t.v)
            return (
              <g key={String(t.v)}>
                <line x1={pad.left} x2={w - pad.right} y1={yPos} y2={yPos} stroke="var(--surface-border)" strokeDasharray="3 4" />
                <text x={pad.left - 6} y={yPos + 3} fontSize="9" fill="var(--tx-muted)" textAnchor="end">{t.label}</text>
              </g>
            )
          })}
          {layers.map((L) => {
            const topPath = cumRows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${posFor(r.layers[L.key], 'end')}`).join(' ')
            const bottomPath = [...cumRows].reverse().map((r, i) => `L ${xFor(cumRows.length - 1 - i)} ${posFor(r.layers[L.key], 'start')}`).join(' ')
            const d = `${topPath} ${bottomPath} Z`
            return <path key={L.key} d={d} fill={L.color} fillOpacity="0.85" stroke="var(--surface-raised)" strokeWidth="0.5" />
          })}
          {active && (
            <line x1={xFor(hover)} x2={xFor(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--tx-primary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          )}
          {cumRows.map((r, i) => (
            <rect
              key={i}
              x={xFor(i) - innerW / Math.max(1, cumRows.length * 2)}
              y={pad.top}
              width={innerW / Math.max(1, cumRows.length)}
              height={innerH}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
          <text x={pad.left} y={h - 8} fontSize="9" fill="var(--tx-muted)">
            {new Date(rows[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
          </text>
          <text x={w - pad.right} y={h - 8} fontSize="9" fill="var(--tx-muted)" textAnchor="end">
            {new Date(rows[rows.length - 1].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
          </text>
        </svg>
        {active && (
          <div style={{
            position: 'absolute', top: '4px', right: '10px',
            background: 'var(--surface-raised)', border: '1px solid var(--surface-border)',
            borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: 'var(--tx-primary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none', minWidth: '160px'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>{new Date(active.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            {layers.map((L) => (
              <div key={L.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: L.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{L.label}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {mode === 'percent' ? `${(active.layers[L.key].share * 100).toFixed(1)}%` : usd(active.layers[L.key].value)}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', paddingTop: '4px', marginTop: '4px', borderTop: '1px solid var(--surface-border)' }}>
              <span style={{ flex: 1, fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{usd(active.total)}</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
          {layers.map((L) => (
            <span key={L.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx-secondary)' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: L.color }} />
              {L.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function polarToXY(cx, cy, r, angleRad) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}
function ringPath(cx, cy, rInner, rOuter, startRad, endRad) {
  const sweep = endRad - startRad
  const large = sweep > Math.PI ? 1 : 0
  const p1 = polarToXY(cx, cy, rOuter, startRad)
  const p2 = polarToXY(cx, cy, rOuter, endRad)
  const p3 = polarToXY(cx, cy, rInner, endRad)
  const p4 = polarToXY(cx, cy, rInner, startRad)
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y} Z`
}

function PortfolioSunburst({ portfolio, card, label, classFilter = 'all' }) {
  const [hover, setHover] = useState(null)
  const allow = (k) => classFilter === 'all' || classFilter === k

  const HOLDING_PALETTE = {
    stocks: ['#60a5fa', '#93c5fd', '#3b82f6', '#bfdbfe'],
    crypto: ['#fbbf24', '#fde68a', '#f59e0b', '#fcd34d'],
    retirement: ['#fb923c', '#fdba74', '#f97316', '#fed7aa'],
    realEstate: ['#a78bfa', '#ddd6fe', '#8b5cf6', '#c4b5fd']
  }

  const withColors = (rows, key) => rows.map((r, i) => ({
    name: r.name, value: r.value, gain: r.gain, gainPct: r.gainPct,
    color: HOLDING_PALETTE[key][i % HOLDING_PALETTE[key].length]
  }))

  const classes = [
    { key: 'stocks', label: 'Stocks', color: '#60a5fa', total: portfolio.stocks.total,
      children: withColors(portfolio.stocks.rows, 'stocks') },
    { key: 'crypto', label: 'Crypto', color: '#fbbf24', total: portfolio.crypto.total,
      children: withColors(portfolio.crypto.rows, 'crypto') },
    { key: 'retirement', label: 'Retirement', color: '#fb923c', total: portfolio.retirement.total,
      children: withColors(
        portfolio.retirement.rows.length > 0
          ? portfolio.retirement.rows
          : [{ name: '401(k) Balance', value: portfolio.retirement.total, gain: portfolio.retirement.gain, gainPct: portfolio.retirement.gainPct }],
        'retirement'
      ) },
    { key: 'realEstate', label: 'Real Estate', color: '#a78bfa', total: portfolio.realEstate.total,
      children: withColors(portfolio.realEstate.rows, 'realEstate') }
  ].filter((c) => c.total > 0 && allow(c.key))

  const total = classes.reduce((s, c) => s + c.total, 0)

  const cx = 130, cy = 130
  const innerR = 46, midR = 78, outerR = 114
  const TAU = Math.PI * 2

  const withFloor = (values, minAngle, containerAngle) => {
    const n = values.length
    if (n === 0) return []
    const totalMin = n * minAngle
    const available = Math.max(0, containerAngle - totalMin)
    const totalVal = values.reduce((s, v) => s + v, 0) || 1
    return values.map((v) => minAngle + (v / totalVal) * available)
  }

  const CLASS_MIN = 0.22
  const HOLDING_MIN = 0.16
  const classAngles = withFloor(classes.map((c) => c.total), CLASS_MIN, TAU)

  const inner = []
  const outer = []
  let acc = -Math.PI / 2
  classes.forEach((c, ci) => {
    const arc = classAngles[ci]
    const start = acc
    const end = acc + arc
    inner.push({ ...c, start, end })
    const holdingAngles = withFloor(c.children.map((ch) => ch.value), Math.min(HOLDING_MIN, arc / Math.max(1, c.children.length)), arc)
    let subAcc = start
    c.children.forEach((child, hi) => {
      const subArc = holdingAngles[hi]
      outer.push({ ...child, class: c, start: subAcc, end: subAcc + subArc })
      subAcc += subArc
    })
    acc = end
  })

  const activeOuter = hover != null ? outer[hover] : null

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p style={{ ...label, margin: 0 }}>Portfolio Composition</p>
        <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Inner = class · Outer = holding · not to scale</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '260px', height: '260px', flexShrink: 0 }}>
          <svg width="260" height="260" viewBox="0 0 260 260" onMouseLeave={() => setHover(null)}>
            {inner.map((c) => (
              <path
                key={`in-${c.key}`}
                d={ringPath(cx, cy, innerR, midR, c.start, c.end)}
                fill={c.color}
                fillOpacity={activeOuter && activeOuter.class.key !== c.key ? 0.25 : 0.85}
                stroke="var(--surface-raised)"
                strokeWidth="1.5"
                style={{ transition: 'fill-opacity 0.12s' }}
              />
            ))}
            {outer.map((o, i) => {
              const active = hover === i
              const dim = hover != null && !active
              const holdingColor = o.color || o.class.color
              return (
                <path
                  key={`out-${i}`}
                  d={ringPath(cx, cy, midR + 2, active ? outerR + 6 : outerR, o.start, o.end)}
                  fill={holdingColor}
                  fillOpacity={dim ? 0.3 : (active ? 1 : 0.9)}
                  stroke="var(--surface-raised)"
                  strokeWidth="1.5"
                  onMouseEnter={() => setHover(i)}
                  onTouchStart={() => setHover(i)}
                  style={{ cursor: 'pointer', transition: 'fill-opacity 0.12s, d 0.12s' }}
                />
              )
            })}
            <circle cx={cx} cy={cy} r={innerR - 2} fill="var(--surface-raised)" />
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
            {activeOuter ? (
              <>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{activeOuter.name}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--tx-primary)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{usd(activeOuter.value)}</div>
                <div style={{ fontSize: '10px', color: activeOuter.gain >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{pct(activeOuter.gainPct)}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--tx-primary)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{usd(total)}</div>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {classes.map((c) => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: c.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{c.label}</span>
              <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{((c.total / total) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PerformanceLadder({ portfolio, card, label, classFilter = 'all' }) {
  const [hover, setHover] = useState(null)
  const allow = (k) => classFilter === 'all' || classFilter === k

  const rows = []
  const push = (className, color, arr) => {
    arr.forEach((r) => rows.push({ name: r.name, className, color, value: r.value, gain: r.gain, gainPct: r.gainPct }))
  }
  if (allow('stocks')) push('Stocks', '#60a5fa', portfolio.stocks.rows)
  if (allow('crypto')) push('Crypto', '#fbbf24', portfolio.crypto.rows)
  if (allow('retirement')) push('Retirement', '#fb923c', portfolio.retirement.rows.length > 0
    ? portfolio.retirement.rows
    : [{ name: '401(k)', value: portfolio.retirement.total, gain: portfolio.retirement.gain, gainPct: portfolio.retirement.gainPct }])
  if (allow('realEstate')) push('Real Estate', '#a78bfa', portfolio.realEstate.rows)

  const sorted = [...rows].sort((a, b) => (b.gain || 0) - (a.gain || 0))
  const maxAbs = Math.max(1, ...sorted.map((r) => Math.abs(r.gain || 0)))

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p style={{ ...label, margin: 0 }}>Performance Ladder</p>
        <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Gain / loss vs cost basis</span>
      </div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No holdings</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sorted.map((r, i) => {
            const isGain = (r.gain || 0) >= 0
            const barPct = (Math.abs(r.gain || 0) / maxAbs) * 100
            const active = hover === i
            return (
              <div
                key={`${r.className}-${r.name}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(i)}
                style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px', gap: '8px', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--tx-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</span>
                </div>
                <div style={{ position: 'relative', height: '18px', background: 'var(--surface-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'var(--surface-border)' }} />
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      bottom: '2px',
                      [isGain ? 'left' : 'right']: '50%',
                      width: `${barPct / 2}%`,
                      background: isGain ? 'linear-gradient(90deg, rgba(34,197,94,0.85), rgba(34,197,94,1))' : 'linear-gradient(270deg, rgba(239,68,68,0.85), rgba(239,68,68,1))',
                      borderRadius: isGain ? '0 3px 3px 0' : '3px 0 0 3px',
                      boxShadow: active ? `0 0 0 1.5px ${isGain ? '#22c55e' : '#ef4444'}` : 'none',
                      transition: 'box-shadow 0.12s'
                    }}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: isGain ? '#22c55e' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                    {isGain ? '+' : ''}{usd(r.gain)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--tx-muted)', fontVariantNumeric: 'tabular-nums' }}>{pct(r.gainPct)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RetirementModal({ onClose, balance }) {
  const infoCard = { backgroundColor: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '14px 16px' }
  const sectionTitle = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--tx-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }
  const bodyText = { fontSize: '13px', color: 'var(--tx-secondary)', margin: '0 0 8px 0', lineHeight: 1.55 }
  const bodyLast = { ...bodyText, marginBottom: 0 }
  const strong = { color: 'var(--tx-primary)', fontWeight: 700 }
  const highlight = { color: '#22c55e', fontWeight: 700 }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '16px', padding: '18px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid var(--surface-border)', marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)' }}>How Your 401(k) Works</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}
          >×</button>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '12px', padding: '18px', marginBottom: '14px', color: '#fff' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9 }}>Current Retirement Balance</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '6px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{usd(balance, { digits: 2 })}</div>
          <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '6px' }}>As of latest sync</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={infoCard}>
            <h3 style={sectionTitle}><span>💰</span> Your Contributions</h3>
            <p style={bodyText}>
              You contribute <b style={strong}>6%</b> of your gross salary to your 401(k) every paycheck. This money is taken out <b style={strong}>before taxes</b>, which means you pay less in income tax now.
            </p>
            <p style={bodyLast}>For example: If you earn $10,000 per month, $600 goes into your 401(k) automatically.</p>
          </div>

          <div style={infoCard}>
            <h3 style={sectionTitle}><span>🏦</span> Company Match</h3>
            <p style={bodyText}>
              SS&amp;C matches your contribution, putting in another <b style={strong}>6%</b> of your salary. This is <b style={highlight}>free money</b> from your employer.
            </p>
            <p style={bodyLast}>Using the same example: SS&amp;C adds another $600, so <b style={strong}>$1,200 total</b> goes into your account each month.</p>
          </div>

          <div style={infoCard}>
            <h3 style={sectionTitle}><span>📈</span> How It Grows</h3>
            <p style={{ ...bodyText, marginBottom: '6px' }}>Your 401(k) balance includes:</p>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--tx-secondary)', lineHeight: 1.6 }}>
              <li>All the money you've contributed since you started</li>
              <li>All the money SS&amp;C has contributed (the match)</li>
              <li>Investment gains or losses from how that money is invested in the market</li>
            </ul>
          </div>

          <div style={infoCard}>
            <h3 style={sectionTitle}><span>🎯</span> The Goal</h3>
            <p style={bodyText}>
              This money is for your retirement. It grows <b style={strong}>tax-free</b> until you withdraw it (usually after age 59½).
            </p>
            <p style={bodyLast}>The longer it stays invested, the more time it has to compound and grow through market returns.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
