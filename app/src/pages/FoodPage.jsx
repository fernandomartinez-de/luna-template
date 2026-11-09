import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: '☕' },
  { key: 'lunch', label: 'Lunch', icon: '☀️' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'snack', label: 'Snacks', icon: '🍎' }
]

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr() {
  return toStr(new Date())
}
function shiftDate(str, delta) {
  const d = new Date(str + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return toStr(d)
}
function dateLabel(str) {
  if (str === todayStr()) return 'Today'
  if (str === shiftDate(todayStr(), -1)) return 'Yesterday'
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function FoodPage() {
  const [view, setView] = useState('log')
  const [viewDate, setViewDate] = useState(todayStr())
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [logged, setLogged] = useState([])
  const [templates, setTemplates] = useState([])
  const [picker, setPicker] = useState(null)
  const [busy, setBusy] = useState(false)
  const [period, setPeriod] = useState('30d')
  const [history, setHistory] = useState([])
  const [burnedToday, setBurnedToday] = useState(null)

  async function loadTemplates() {
    const { data } = await supabase.from('meal_templates').select('*').eq('active', true).order('name', { ascending: true })
    setTemplates(data || [])
  }

  async function loadDay() {
    const { data } = await supabase.from('nutrition_log').select('*').eq('logged_date', viewDate).order('created_at', { ascending: true })
    const rows = data || []
    setLogged(rows)
    setTotals(rows.reduce((a, r) => ({
      calories: a.calories + Number(r.calories_kcal || 0),
      protein: a.protein + Number(r.protein_g || 0),
      carbs: a.carbs + Number(r.carbs_g || 0),
      fat: a.fat + Number(r.fat_g || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 }))
  }

  async function loadHistory() {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const start = shiftDate(todayStr(), -(days - 1))
    const { data } = await supabase.from('nutrition_log').select('logged_date, protein_g, carbs_g, fat_g').gte('logged_date', start).order('logged_date', { ascending: true })
    const byDay = {}
    ;(data || []).forEach((r) => {
      const k = r.logged_date
      if (!byDay[k]) byDay[k] = { date: k, protein: 0, carbs: 0, fat: 0 }
      byDay[k].protein += Number(r.protein_g || 0)
      byDay[k].carbs += Number(r.carbs_g || 0)
      byDay[k].fat += Number(r.fat_g || 0)
    })
    setHistory(Object.values(byDay))
  }

  async function loadBurnedForDate(dateStr) {
    // Pick the whoop_cycles row whose local date matches dateStr.
    const start = new Date(dateStr + 'T00:00:00')
    const end = new Date(start); end.setDate(end.getDate() + 1)
    const { data, error } = await supabase
      .from('whoop_cycles')
      .select('start_time, calories_kcal')
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString())
      .order('start_time', { ascending: false })
      .limit(1)
    if (error) { setBurnedToday(null); return }
    if (data && data.length > 0 && data[0].calories_kcal != null) {
      setBurnedToday(Math.round(Number(data[0].calories_kcal)))
    } else {
      setBurnedToday(null)
    }
  }

  useEffect(() => { loadTemplates() }, [])
  useEffect(() => { loadDay(); loadBurnedForDate(viewDate) }, [viewDate])
  useEffect(() => { loadHistory() }, [period])

  async function logMeal(mealKey, tpl) {
    setBusy(true)
    await supabase.from('nutrition_log').insert({
      logged_date: viewDate, meal: mealKey, item: tpl.name,
      calories_kcal: tpl.calories, protein_g: tpl.protein_g, carbs_g: tpl.carbs_g, fat_g: tpl.fat_g, source: 'template'
    })
    setBusy(false)
    setPicker(null)
    loadDay()
    loadHistory()
  }

  async function removeLog(id) {
    await supabase.from('nutrition_log').delete().eq('id', id)
    loadDay()
    loadHistory()
  }

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }
  const addBtn = { border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--brand-400)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }
  const xBtn = { border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, flexShrink: 0 }
  const tplBtn = { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }
  const navArrow = { padding: '8px 14px', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '10px', color: 'var(--tx-secondary)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }
  const periodBtn = (active) => ({ padding: '6px 12px', backgroundColor: active ? 'var(--surface-overlay)' : 'transparent', border: active ? '1px solid var(--surface-border)' : '1px solid transparent', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, color: active ? 'var(--tx-primary)' : 'var(--tx-muted)', cursor: 'pointer' })
  const suggestBtn = { flexShrink: 0, backgroundColor: 'var(--brand-500)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
  const sectionLabel = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 10px 0' }
  const macroChip = { fontSize: '11px', fontWeight: 600, color: 'var(--tx-secondary)', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '3px 8px' }
  const atToday = viewDate >= todayStr()

  const ring = (value, goal, color, label) => {
    const pct = Math.min((value / goal) * 100, 100)
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 12px' }}>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-muted)" strokeWidth="6"></circle>
            <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${pct * 2.14} 214`} strokeLinecap="round"></circle>
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.1rem', fontWeight: 700, color }}>{Math.round(pct)}%</div>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: '2px' }}>{Math.round(value)}g</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>{label} / {goal}g</div>
      </div>
    )
  }

  return (
    <div>
      {view === 'log' ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', margin: '0 0 4px 0' }}>Nutrition</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--tx-muted)', margin: 0 }}>Macros &amp; meals</p>
          </div>
          <button onClick={() => setView('suggest')} style={suggestBtn}>Suggestions ›</button>
        </div>
      ) : (
        <div style={{ marginBottom: '16px' }}>
          <button onClick={() => setView('log')} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500, padding: 0, marginBottom: '8px' }}>← Nutrition</button>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>Meal Suggestions</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--tx-muted)', margin: '4px 0 0 0' }}>Your meal library. Tap + Log to add to today.</p>
        </div>
      )}

      {view === 'log' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <button onClick={() => setViewDate(shiftDate(viewDate, -1))} style={navArrow}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '10px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx-primary)' }}>📅 {dateLabel(viewDate)}</span>
            </div>
            <button onClick={() => { if (!atToday) setViewDate(shiftDate(viewDate, 1)) }} disabled={atToday} style={{ ...navArrow, opacity: atToday ? 0.3 : 1, cursor: atToday ? 'default' : 'pointer' }}>›</button>
          </div>

          {/* Calorie balance — burned vs eaten */}
          {(() => {
            const burned = burnedToday || 0
            const eaten = Math.round(totals.calories)
            const delta = burned - eaten
            const isDeficit = delta > 0
            const totalMag = Math.max(burned + eaten, 1)
            const burnedPct = (burned / totalMag) * 100
            const eatenPct = (eaten / totalMag) * 100
            const deltaColor = isDeficit ? '#22c55e' : (delta === 0 ? 'var(--tx-secondary)' : '#f59e0b')
            const label = burnedToday == null && eaten === 0
              ? 'No data yet today'
              : delta === 0 ? 'Balanced' : (isDeficit ? 'deficit' : 'surplus')
            return (
              <div style={{ ...card, padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>🔥</span>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Burned</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#22c55e', lineHeight: 1 }}>{burnedToday != null ? burned.toLocaleString() : '—'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0 8px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: deltaColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {burnedToday == null && eaten === 0 ? '—' : (delta === 0 ? '0' : `${delta > 0 ? '−' : '+'}${Math.abs(delta).toLocaleString()}`)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px', fontWeight: 600 }}>{label}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Eaten</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f59e0b', lineHeight: 1 }}>{eaten.toLocaleString()}</div>
                    </div>
                    <span style={{ fontSize: '1rem' }}>🍽️</span>
                  </div>
                </div>
                {/* Split bar */}
                <div style={{ position: 'relative', height: '10px', background: 'var(--surface-muted)', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${burnedPct}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', transition: 'width 0.4s ease' }} />
                  <div style={{ width: `${eatenPct}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--tx-muted)', marginTop: '6px' }}>
                  <span>{burnedPct.toFixed(0)}%</span>
                  <span>kcal balance</span>
                  <span>{eatenPct.toFixed(0)}%</span>
                </div>
              </div>
            )
          })()}

          <div style={{ ...card, padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', fontWeight: 500 }}>Calories</span>
              <div style={{ padding: '4px 12px', backgroundColor: 'rgba(0, 184, 217, 0.15)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38d8fb' }}>{Math.max(0, 2000 - Math.round(totals.calories))} left</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1 }}>{Math.round(totals.calories)}</span>
              <span style={{ fontSize: '1rem', color: 'var(--tx-muted)' }}>/ 2000</span>
            </div>
            <div style={{ height: '6px', backgroundColor: 'var(--surface-muted)', borderRadius: '3px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ height: '100%', width: `${Math.min((totals.calories / 2000) * 100, 100)}%`, backgroundColor: '#00b8d9', transition: 'width 0.3s ease' }}></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {ring(totals.protein, 150, '#3b82f6', 'Protein')}
              {ring(totals.carbs, 250, '#f59e0b', 'Carbs')}
              {ring(totals.fat, 65, '#8b5cf6', 'Fat')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            {MEALS.map((mealDef) => {
              const items = logged.filter((r) => r.meal === mealDef.key)
              const opts = templates.filter((t) => t.meal === mealDef.key)
              const isOpen = picker === mealDef.key
              return (
                <div key={mealDef.key} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{mealDef.icon}</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)' }}>{mealDef.label}</span>
                    </div>
                    <button onClick={() => setPicker(isOpen ? null : mealDef.key)} style={addBtn}>{isOpen ? 'Close' : '+ Add'}</button>
                  </div>
                  {items.length === 0 && !isOpen && (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--tx-muted)', fontSize: '0.85rem' }}>Tap add to log food</div>
                  )}
                  {items.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', marginTop: '8px', borderTop: '1px solid var(--surface-border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item}</div>
                        <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{Math.round(r.calories_kcal || 0)} kcal · {Math.round(r.protein_g || 0)}P {Math.round(r.carbs_g || 0)}C {Math.round(r.fat_g || 0)}F</div>
                      </div>
                      <button onClick={() => removeLog(r.id)} title="Remove" style={xBtn}>×</button>
                    </div>
                  ))}
                  {isOpen && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {opts.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>No {mealDef.label.toLowerCase()} templates yet.</div>
                      ) : (
                        opts.map((t) => (
                          <button key={t.id} disabled={busy} onClick={() => logMeal(mealDef.key, t)} style={tplBtn}>
                            <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-primary)', fontSize: '13px' }}>{t.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--tx-muted)', flexShrink: 0 }}>{Math.round(t.calories)} kcal · {Math.round(t.protein_g)}P</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ ...card, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)', margin: 0 }}>Macro History</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['7d', '30d', '90d'].map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} style={periodBtn(period === p)}>{p}</button>
                ))}
              </div>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.3 }}>📊</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--tx-muted)', margin: 0 }}>No data yet. Start logging meals.</p>
              </div>
            ) : (() => {
              const maxG = Math.max(...history.map((h) => h.protein + h.carbs + h.fat), 1)
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
                  {history.map((h) => {
                    const tot = h.protein + h.carbs + h.fat
                    return (
                      <div key={h.date} title={`${h.date}: ${Math.round(h.protein)}P ${Math.round(h.carbs)}C ${Math.round(h.fat)}F`} style={{ flex: 1, height: `${(tot / maxG) * 100}%`, minHeight: tot > 0 ? '2px' : '0', display: 'flex', flexDirection: 'column', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                        <div style={{ height: `${tot ? (h.protein / tot) * 100 : 0}%`, background: '#3b82f6' }} />
                        <div style={{ height: `${tot ? (h.carbs / tot) * 100 : 0}%`, background: '#f59e0b' }} />
                        <div style={{ height: `${tot ? (h.fat / tot) * 100 : 0}%`, background: '#8b5cf6' }} />
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px' }}>
              {[['Protein', '#3b82f6'], ['Carbs', '#f59e0b'], ['Fat', '#8b5cf6']].map(([lab, col]) => (
                <div key={lab} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: col, borderRadius: '2px' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>{lab}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'suggest' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {MEALS.map((mealDef) => {
            const opts = templates.filter((t) => t.meal === mealDef.key)
            if (opts.length === 0) return null
            return (
              <div key={mealDef.key}>
                <p style={sectionLabel}>{mealDef.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {opts.map((t) => (
                    <div key={t.id} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{t.name}</div>
                          {t.items && <div style={{ fontSize: '12px', color: 'var(--tx-muted)', marginTop: '4px', lineHeight: 1.4 }}>{t.items}</div>}
                        </div>
                        <button disabled={busy} onClick={() => logMeal(mealDef.key, t)} style={addBtn}>+ Log</button>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <span style={macroChip}>kcal {Math.round(t.calories)}</span>
                        <span style={macroChip}>P {Math.round(t.protein_g)}g</span>
                        <span style={macroChip}>C {Math.round(t.carbs_g)}g</span>
                        <span style={macroChip}>F {Math.round(t.fat_g)}g</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
