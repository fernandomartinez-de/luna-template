import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import WebThreads from '../components/WebThreads/WebThreads.jsx'
import CodeSlots from '../components/CodeSlots/CodeSlots.jsx'
import LunaBurst from '../components/LunaBurst.jsx'
import { checkPin } from '../utils/pin.js'
import { OWNER_NAME } from '../config.js'
import { moneyCompact } from '../config.js'



function usdCompact(n) {
  return moneyCompact(n)
}
function firstOfMonthIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function HubPage() {
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 5 ? 'Still up' :
    hour < 12 ? 'Good morning' :
    hour < 18 ? 'Good afternoon' :
    hour < 22 ? 'Good evening' :
    'Good night'
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const [portfolioTotal, setPortfolioTotal] = useState(null)
  const [monthDeltaPct, setMonthDeltaPct] = useState(null)
  const [strain, setStrain] = useState(null)
  const [recovery, setRecovery] = useState(null)
  const [financesUnlocked, setFinancesUnlocked] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [pinStatus, setPinStatus] = useState('idle')

  const handlePin = async (code) => {
    let ok = false
    try { ok = await checkPin(code) } catch (e) { ok = false }
    if (ok) {
      setPinStatus('success')
      setTimeout(() => setFinancesUnlocked(true), 320)
    } else {
      setPinStatus('danger')
      setTimeout(() => { setPinValue(''); setPinStatus('idle') }, 720)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [scRes, reRes, cycRes, recRes] = await Promise.all([
        supabase.from('stocks_crypto_history').select('snapshot_date, asset_type, total_value').order('snapshot_date', { ascending: false }).limit(400),
        supabase.from('real_estate_history').select('snapshot_date, asset_name, data_source, home_value').order('snapshot_date', { ascending: false }).limit(60),
        supabase.from('whoop_cycles').select('start_time, strain').order('start_time', { ascending: false }).limit(1),
        supabase.from('whoop_recovery').select('recovery_date, recovery_score').order('recovery_date', { ascending: false }).limit(1)
      ])
      if (cancelled) return

      const sc = scRes.data || []
      const re = reRes.data || []

      const scByDate = {}
      sc.forEach((r) => {
        const d = r.snapshot_date
        if (!scByDate[d]) scByDate[d] = { stocks: 0, crypto: 0, retirement: 0 }
        const v = Number(r.total_value) || 0
        if (r.asset_type === 'Stock') scByDate[d].stocks += v
        else if (r.asset_type === 'Crypto') scByDate[d].crypto += v
        else if (r.asset_type === 'Retirement' || r.asset_type === 'Brokerage') scByDate[d].retirement += v
      })

      const reByDate = {}
      re.forEach((r) => {
        const d = r.snapshot_date
        if (!reByDate[d]) reByDate[d] = {}
        if (!reByDate[d][r.asset_name]) reByDate[d][r.asset_name] = { z: [], rd: [], o: [] }
        const bucket = r.data_source === 'Zillow' ? 'z' : r.data_source === 'Redfin' ? 'rd' : 'o'
        reByDate[d][r.asset_name][bucket].push(Number(r.home_value) || 0)
      })

      const totalForDate = (d) => {
        const s = scByDate[d] || { stocks: 0, crypto: 0, retirement: 0 }
        let re = 0
        if (reByDate[d]) {
          Object.values(reByDate[d]).forEach((a) => {
            const zAvg = a.z.length ? a.z.reduce((x, y) => x + y, 0) / a.z.length : 0
            const rAvg = a.rd.length ? a.rd.reduce((x, y) => x + y, 0) / a.rd.length : 0
            const oAvg = a.o.length ? a.o.reduce((x, y) => x + y, 0) / a.o.length : 0
            re += zAvg && rAvg ? (zAvg + rAvg) / 2 : (zAvg || rAvg || oAvg)
          })
        }
        return s.stocks + s.crypto + (s.retirement || 0) + re
      }

      const allDates = [...new Set([...Object.keys(scByDate), ...Object.keys(reByDate)])].sort()
      if (allDates.length > 0) {
        const latestDate = allDates[allDates.length - 1]
        const latest = totalForDate(latestDate)
        setPortfolioTotal(latest)

        const [ly, lm] = latestDate.substring(0, 7).split('-').map(Number)
        const prevM = lm === 1 ? 12 : lm - 1
        const prevY = lm === 1 ? ly - 1 : ly
        const prevMonthKey = `${prevY}-${String(prevM).padStart(2, '0')}`
        const priorMonthDates = allDates.filter((d) => d.startsWith(prevMonthKey))
        const baseline = priorMonthDates.length > 0
          ? totalForDate(priorMonthDates[priorMonthDates.length - 1])
          : null
        if (baseline && baseline > 0) setMonthDeltaPct(((latest - baseline) / baseline) * 100)
        else setMonthDeltaPct(null)
      }

      if (cycRes.data && cycRes.data.length > 0 && cycRes.data[0].strain != null) setStrain(Number(cycRes.data[0].strain))
      if (recRes.data && recRes.data.length > 0 && recRes.data[0].recovery_score != null) setRecovery(Number(recRes.data[0].recovery_score))
    }
    load()
    return () => { cancelled = true }
  }, [])

  const gainColor = (n) => (n == null ? 'var(--tx-muted)' : n >= 0 ? '#22c55e' : '#ef4444')

  const sections = [
    {
      to: '/finances',
      key: 'finances',
      title: 'Finances',
      description: 'Investment portfolio, spending analytics, and net worth tracking.',
      iconBg: 'rgba(34,197,94,0.12)',
      iconBorder: 'rgba(34,197,94,0.35)',
      iconColor: '#22c55e',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"></path>
          <path d="m19 9-5 5-4-4-3 3"></path>
        </svg>
      ),
      stats: [
        { label: 'Portfolio', value: !financesUnlocked ? '••••' : (portfolioTotal != null ? usdCompact(portfolioTotal) : '--'), color: financesUnlocked ? 'var(--tx-primary)' : 'var(--tx-muted)' },
        { label: 'This Month', value: monthDeltaPct != null ? `${monthDeltaPct >= 0 ? '+' : ''}${monthDeltaPct.toFixed(0)}%` : '--', color: gainColor(monthDeltaPct) }
      ],
      cta: 'Open Dashboard'
    },
    {
      to: '/fitness',
      title: 'Fitness & Nutrition',
      description: 'Training plans, nutrition tracking, and WHOOP performance data.',
      iconBg: 'rgba(239,68,68,0.12)',
      iconBorder: 'rgba(239,68,68,0.35)',
      iconColor: '#ef4444',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
          <path d="m2.5 21.5 1.4-1.4"></path>
          <path d="m20.1 3.9 1.4-1.4"></path>
          <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>
          <path d="m9.6 14.4 4.8-4.8"></path>
        </svg>
      ),
      stats: [
        { label: 'Strain', value: strain != null ? strain.toFixed(1) : '--', color: 'var(--tx-primary)' },
        { label: 'Recovery', value: recovery != null ? `${Math.round(recovery)}%` : '--', color: recovery != null ? (recovery >= 67 ? '#22c55e' : recovery >= 34 ? '#f59e0b' : '#ef4444') : 'var(--tx-muted)' }
      ],
      cta: 'Open Overload'
    }
  ]

  const cardStyle = {
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 24px 20px 24px',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(20, 24, 40, 0.22) 40%, rgba(15, 18, 32, 0.28) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.09)',
    backdropFilter: 'blur(22px) saturate(160%)',
    WebkitBackdropFilter: 'blur(22px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 30px rgba(0, 0, 0, 0.35)',
    color: 'var(--tx-primary)',
    textDecoration: 'none',
    transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
    height: '100%'
  }
  const iconBox = (bg, border, color) => ({
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    background: `radial-gradient(circle at 30% 20%, ${bg.replace('0.12', '0.28')}, rgba(255,255,255,0.02) 70%)`,
    border: `1px solid ${border}`,
    color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 12px ${bg.replace('0.12', '0.35')}`
  })
  const titleStyle = { fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--tx-primary)' }
  const descStyle = { fontSize: '0.82rem', color: 'var(--tx-muted)', margin: 0, lineHeight: 1.5 }
  const divider = { height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '14px 0' }
  const statLabel = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', marginBottom: '4px' }
  const openLinkWrap = {
    marginTop: 'auto',
    paddingTop: '18px',
    display: 'flex',
    alignItems: 'center'
  }
  const openLink = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 18px',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.14)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 14px rgba(82,39,255,0.18)',
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '0.01em'
  }
  const openLinkText = {
    backgroundImage: 'linear-gradient(90deg, #ffffff, #ff9ffc, #5227ff, #ff9ffc, #ffffff)',
    backgroundSize: '300% 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    animation: 'hub-cta-flow 6s linear infinite'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.85 }}>
          <WebThreads
            color1="#5227ff"
            color2="#ff9ffc"
            color3="#ffffff"
            speed={0.15}
            threadCount={10}
            frequency={9.5}
            spread={0.22}
            taper={0.1}
            position={0.5}
            fanMode="center"
            glow={0.014}
            falloff={0.69}
            thickness={0.65}
            brightness={0.2}
            opacity={0.59}
            mirror={true}
            shimmer={false}
            grain={false}
            grainIntensity={0.09}
            mouseInteraction={false}
            mouseStrength={0.27}
          />
        </div>
        <div aria-hidden="true" style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '120px',
          height: '120px',
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.9
        }}>
          <LunaBurst size={120} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 160px)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px 6px 6px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontSize: '0.75rem',
            color: 'var(--tx-secondary)',
            fontWeight: 500
          }}>
            <span style={{
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.95)',
              color: '#0a0f1f',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.06em'
            }}>{dayName.slice(0, 3).toUpperCase()}</span>
            <span>{monthDay}</span>
          </div>
          <h1 style={{
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: 'var(--tx-primary)',
            margin: '8px 0 0 0',
            maxWidth: '780px',
            background: 'linear-gradient(180deg, #ffffff, rgba(255,255,255,0.75))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 20px rgba(82,39,255,0.15)'
          }}>
            {greeting}{OWNER_NAME ? `, ${OWNER_NAME}` : ''}.
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--tx-muted)', margin: '4px 0 0 0', maxWidth: '540px', lineHeight: 1.5 }}>
            One dashboard for finances and fitness. Pick a lane.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', width: '100%', maxWidth: '860px', marginTop: 'auto' }}>
            {sections.map((s) => (
              <Link key={s.to} to={s.to} className="hub-card" style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ ...iconBox(s.iconBg, s.iconBorder, s.iconColor), marginBottom: 0, width: '36px', height: '36px', borderRadius: '12px' }}>{s.icon}</div>
                  <h2 style={{ ...titleStyle, margin: 0, fontSize: '1rem' }}>{s.title}</h2>
                </div>
                <div style={{ ...divider, margin: '0 0 12px 0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', alignItems: 'end' }}>
                  {s.stats.map((st, i) => {
                    const isPortfolioLocked = s.key === 'finances' && st.label === 'Portfolio' && !financesUnlocked
                    return (
                      <div key={i}>
                        <div style={statLabel}>{st.label}</div>
                        {isPortfolioLocked ? (
                          <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }} style={{ marginTop: '2px' }}>
                            <CodeSlots
                              length={4}
                              value={pinValue}
                              onChange={setPinValue}
                              onComplete={handlePin}
                              status={pinStatus}
                              autoFocus={false}
                              slotSize={22}
                              gap={4}
                              radius={6}
                              accentColor="#22c55e"
                              slotColor="rgba(255,255,255,0.06)"
                              digitColor="#f1f5f9"
                              inkColor="#f1f5f9"
                              dangerColor="#ef4444"
                              ariaLabel="Portfolio unlock code"
                            />
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: st.color, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{st.value}</span>
                            {s.key === 'finances' && st.label === 'Portfolio' && financesUnlocked && (
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFinancesUnlocked(false); setPinValue(''); setPinStatus('idle') }}
                                aria-label="Lock portfolio"
                                title="Lock portfolio"
                                style={{ background: 'transparent', border: 'none', color: 'var(--tx-muted)', cursor: 'pointer', padding: 0, fontSize: '11px', lineHeight: 1 }}
                              >🔒</button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ ...openLinkWrap, paddingTop: '14px' }}>
                  <span style={openLink}>
                    <span style={openLinkText}>{s.cta}</span>
                    <span className="hub-cta-arrow" style={{ ...openLinkText, fontSize: '0.9rem' }}>›</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      <style>{`
        @keyframes hub-cta-flow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes hub-arrow-flow {
          0%   { transform: translateX(0); }
          50%  { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        .hub-card {
          position: relative;
          overflow: hidden;
        }
        .hub-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(82,39,255,0), rgba(82,39,255,0.5), rgba(255,159,252,0.5), rgba(82,39,255,0));
          background-size: 300% 300%;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.25s ease;
          animation: hub-cta-flow 8s linear infinite;
          pointer-events: none;
        }
        .hub-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 32px rgba(82, 39, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.16);
        }
        .hub-card:hover::before { opacity: 1; }
        .hub-cta-arrow {
          display: inline-block;
          animation: hub-arrow-flow 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
