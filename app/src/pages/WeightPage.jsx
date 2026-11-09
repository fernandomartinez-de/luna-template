import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function WeightPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [weightHistory, setWeightHistory] = useState([])
  const [currentWeight, setCurrentWeight] = useState(null)
  const [stats, setStats] = useState({ avg: null, low: null, high: null })

  useEffect(() => {
    loadWeightData()
  }, [])

  async function loadWeightData() {
    const { data, error } = await supabase
      .from('body_composition')
      .select('measured_at, weight_kg')
      .order('measured_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Weight data error:', error)
      return
    }

    console.log('Weight data:', data)

    if (data && data.length > 0) {
      // Renpho stores kg natively — keep as kg, one decimal.
      const formatted = data.map((entry, index) => {
        const weightKg = Number(entry.weight_kg).toFixed(1)
        const prevWeight = data[index + 1] ? Number(data[index + 1].weight_kg).toFixed(1) : null
        const change = prevWeight ? (weightKg - prevWeight).toFixed(1) : null

        return {
          date: new Date(entry.measured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          weight: parseFloat(weightKg),
          change: change ? (change > 0 ? `+${change}` : change) : null
        }
      })

      setWeightHistory(formatted)
      setCurrentWeight(formatted[0].weight)

      const weights = formatted.map(e => parseFloat(e.weight))
      setStats({
        avg: (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1),
        low: Math.min(...weights).toFixed(1),
        high: Math.max(...weights).toFixed(1)
      })
    }
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>
          Weight
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--tx-muted)', marginTop: '4px' }}>
          Track your body weight over time
        </p>
      </div>

      {/* Current Weight Card */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', fontWeight: 500, margin: '0 0 8px 0' }}>
          WEIGHT (KG)
        </p>
        <p style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>
          {currentWeight || '—'}
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {/* AVG */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)' }}>
              <path d="M3 3v18h18"></path>
              <path d="m19 9-5 5-4-4-3 3"></path>
            </svg>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', fontWeight: 500 }}>
              AVG
            </span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>
            {stats.avg || '—'}
          </p>
        </div>

        {/* LOW */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)' }}>
              <path d="m9 6-6 6 6 6"></path>
              <path d="M3 12h14"></path>
              <path d="m17 6 6 6-6 6"></path>
            </svg>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', fontWeight: 500 }}>
              LOW
            </span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>
            {stats.low || '—'}
          </p>
        </div>

        {/* HIGH */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)' }}>
              <path d="m15 18 6-6-6-6"></path>
              <path d="M21 12H7"></path>
              <path d="m7 6-6 6 6 6"></path>
            </svg>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', fontWeight: 500 }}>
              HIGH
            </span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>
            {stats.high || '—'}
          </p>
        </div>
      </div>

      {/* Trend Chart */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)', margin: 0 }}>
            Trend
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSelectedPeriod('7d')}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedPeriod === '7d' ? 'var(--surface-overlay)' : 'transparent',
                border: selectedPeriod === '7d' ? '1px solid var(--surface-border)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: selectedPeriod === '7d' ? 'var(--tx-primary)' : 'var(--tx-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              7d
            </button>
            <button
              onClick={() => setSelectedPeriod('30d')}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedPeriod === '30d' ? 'var(--surface-overlay)' : 'transparent',
                border: selectedPeriod === '30d' ? '1px solid var(--surface-border)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: selectedPeriod === '30d' ? 'var(--tx-primary)' : 'var(--tx-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              30d
            </button>
            <button
              onClick={() => setSelectedPeriod('90d')}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedPeriod === '90d' ? 'var(--surface-overlay)' : 'transparent',
                border: selectedPeriod === '90d' ? '1px solid var(--surface-border)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: selectedPeriod === '90d' ? 'var(--tx-primary)' : 'var(--tx-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              90d
            </button>
            <button
              onClick={() => setSelectedPeriod('all')}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedPeriod === 'all' ? 'var(--surface-overlay)' : 'transparent',
                border: selectedPeriod === 'all' ? '1px solid var(--surface-border)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: selectedPeriod === 'all' ? 'var(--tx-primary)' : 'var(--tx-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              All
            </button>
          </div>
        </div>

        {/* Chart Area */}
        {weightHistory.length > 0 ? (
          <div style={{ padding: '20px', height: '200px', position: 'relative' }}>
            <svg width="100%" height="180" style={{ overflow: 'visible' }}>
              {/* Draw line chart */}
              {(() => {
                const chartData = weightHistory.slice(0, selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : weightHistory.length).reverse()
                if (chartData.length === 0) return null

                const weights = chartData.map(d => d.weight)
                const minWeight = Math.min(...weights) - 2
                const maxWeight = Math.max(...weights) + 2
                const range = maxWeight - minWeight

                const points = chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1)) * 100
                  const y = 100 - ((d.weight - minWeight) / range) * 100
                  return { x: `${x}%`, y: `${y}%`, weight: d.weight }
                })

                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

                return (
                  <>
                    {/* Line */}
                    <path d={pathD} fill="none" stroke="#00b8d9" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {/* Points */}
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#00b8d9" />
                    ))}
                  </>
                )
              })()}
            </svg>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--tx-muted)', margin: 0 }}>
              No data for this period
            </p>
          </div>
        )}
      </div>

      {/* History */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)', marginBottom: '16px' }}>
          History
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {weightHistory.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
                  {entry.date.split(' ')[1].replace(',', '')}
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx-primary)', margin: 0 }}>
                    {entry.weight} kg
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', margin: '2px 0 0 0' }}>
                    {entry.date}
                  </p>
                </div>
              </div>
              {entry.change && (
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: entry.change.startsWith('+') ? '#ef4444' : '#22c55e'
                }}>
                  {entry.change}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
