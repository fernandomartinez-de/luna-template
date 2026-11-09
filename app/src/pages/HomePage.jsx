import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { currentProgramWeek, weekDateRange } from '../utils/program.js'

// Format a Date as YYYY-MM-DD from LOCAL calendar fields (not UTC).
function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Map a WHOOP sport_name to a matching glyph for the Recent Workout badge.
function sportEmoji(sport) {
  const s = (sport || '').toLowerCase()
  if (s.includes('run')) return '🏃'
  if (s.includes('walk')) return '🚶'
  if (s.includes('soccer') || s.includes('football')) return '⚽'
  if (s.includes('weight') || s.includes('lift') || s.includes('strength') || s.includes('power')) return '🏋️'
  if (s.includes('golf')) return '⛳'
  if (s.includes('hockey')) return '🏒'
  if (s.includes('cycl') || s.includes('bike') || s.includes('ride') || s.includes('spin')) return '🚴'
  if (s.includes('swim')) return '🏊'
  if (s.includes('tennis')) return '🎾'
  if (s.includes('basket')) return '🏀'
  if (s.includes('yoga')) return '🧘'
  if (s.includes('box')) return '🥊'
  if (s.includes('row')) return '🚣'
  if (s.includes('hik')) return '🥾'
  if (s.includes('ski')) return '⛷️'
  return '💪'
}

export default function HomePage() {
  const now = new Date()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const hour = now.getHours()
  const greeting =
    hour < 5 ? 'Still up' :
    hour < 12 ? 'Good morning' :
    hour < 18 ? 'Good afternoon' :
    hour < 22 ? 'Good evening' :
    'Good night'

  // State
  const [weightHover, setWeightHover] = useState(null)
  const [weekSessions, setWeekSessions] = useState(0)
  const [weightData, setWeightData] = useState([])
  const [lastWorkout, setLastWorkout] = useState(null)
  const [nutritionToday, setNutritionToday] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [workoutDays, setWorkoutDays] = useState([])
  const [workoutsByDay, setWorkoutsByDay] = useState({})
  const [strainRange, setStrainRange] = useState(14)
  const [strainData, setStrainData] = useState([])
  const [todayBurn, setTodayBurn] = useState(0)
  const [muscleBalance, setMuscleBalance] = useState([])
  const [completedCount, setCompletedCount] = useState(0)

  // Load data
  useEffect(() => {
    loadWorkoutStats()
    loadWeightData()
    loadLastWorkout()
    loadNutritionToday()
    loadConsistencyData()
    loadTodayCalories()
    loadMuscleBalance()
  }, [])

  useEffect(() => {
    loadStrainData(strainRange)
  }, [strainRange])

  async function loadWorkoutStats() {
    const wk = currentProgramWeek()
    if (wk < 1) { setWeekSessions(0); return }
    const range = weekDateRange(wk)

    const { data, error } = await supabase
      .from('completed_workouts')
      .select('created_at')
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())

    if (error) {
      console.error('Workout stats error:', error)
      return
    }

    if (data) setWeekSessions(data.length)
  }

  async function loadWeightData() {
    const { data, error } = await supabase
      .from('body_composition')
      .select('measured_at, weight_kg')
      .order('measured_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Weight data error:', error)
      return
    }

    console.log('Weight data:', data)

    if (data && data.length > 0) {
      const formatted = data.reverse().map(d => ({
        date: new Date(d.measured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: Number(d.weight_kg).toFixed(1) // kg — Renpho native unit
      }))
      setWeightData(formatted)
    }
  }

  async function loadLastWorkout() {
    const { data, error } = await supabase
      .from('whoop_workouts')
      .select('*')
      .not('sport_name', 'in', '("Walking","Activity")')
      .order('start_time', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Last workout error:', error)
      return
    }

    console.log('Last workout:', data)

    if (data && data.length > 0) {
      setLastWorkout(data[0])
    }
  }

  async function loadNutritionToday() {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const { data } = await supabase
      .from('nutrition_log')
      .select('calories_kcal, protein_g, carbs_g, fat_g')
      .eq('logged_date', today)

    if (data) {
      const totals = data.reduce((acc, item) => ({
        calories: acc.calories + Number(item.calories_kcal || 0),
        protein: acc.protein + Number(item.protein_g || 0),
        carbs: acc.carbs + Number(item.carbs_g || 0),
        fat: acc.fat + Number(item.fat_g || 0)
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
      setNutritionToday(totals)
    }
  }

  async function loadConsistencyData() {
    // Load last 60 days of workouts (9-week calendar covers the window)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 65)

    const { data, error } = await supabase
      .from('whoop_workouts')
      .select('start_time, sport_name, strain')
      .not('sport_name', 'in', '("Walking","Activity")')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())

    if (error) {
      console.error('Consistency data error:', error)
      return
    }

    if (data) {
      const dates = data.map(w => toLocalDateStr(new Date(w.start_time)))
      const byDay = {}
      data.forEach(w => {
        const key = toLocalDateStr(new Date(w.start_time))
        if (!byDay[key]) byDay[key] = []
        byDay[key].push({
          sport_name: w.sport_name,
          strain: w.strain != null ? Number(w.strain) : null
        })
      })
      setWorkoutDays(dates)
      setWorkoutsByDay(byDay)
    }
  }

  async function loadMuscleBalance() {
    const { data, error } = await supabase
      .from('completed_workouts')
      .select('workouts(workout_exercises(exercises(muscle_group)))')

    if (error) {
      console.error('Muscle balance error:', error)
      return
    }

    const tally = {}
    ;(data || []).forEach((cw) => {
      const wes = cw.workouts && cw.workouts.workout_exercises ? cw.workouts.workout_exercises : []
      wes.forEach((we) => {
        const m = we.exercises && we.exercises.muscle_group
        if (m) tally[m] = (tally[m] || 0) + 1
      })
    })
    const arr = Object.entries(tally)
      .map(([muscle, count]) => ({ muscle, count }))
      .sort((a, b) => b.count - a.count)
    setMuscleBalance(arr)
    setCompletedCount((data || []).length)
  }

  async function loadTodayCalories() {
    const { data, error } = await supabase
      .from('whoop_cycles')
      .select('calories_kcal')
      .order('start_time', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Today calories error:', error)
      return
    }

    if (data && data.length > 0 && data[0].calories_kcal != null) {
      setTodayBurn(Math.round(Number(data[0].calories_kcal)))
    }
  }

  async function loadStrainData(days) {
    const { data, error } = await supabase
      .from('whoop_cycles')
      .select('start_time, strain')
      .order('start_time', { ascending: false })
      .limit(days)

    if (error) {
      console.error('Strain data error:', error)
      return
    }

    if (data) {
      const rows = data
        .filter(d => d.strain != null)
        .reverse()
        .map(d => ({ date: new Date(d.start_time), strain: Number(d.strain) }))
      setStrainData(rows)
    }
  }

  const minWeight = weightData.length > 0 ? Math.min(...weightData.map(d => parseFloat(d.weight))) - 0.5 : 68
  const maxWeight = weightData.length > 0 ? Math.max(...weightData.map(d => parseFloat(d.weight))) + 0.5 : 69
  const weightRange = maxWeight - minWeight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, margin: 0 }}>
            {dayName}, {monthDay}
          </p>
          <h1 style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--tx-primary)', marginTop: '2px', marginBottom: 0 }}>
            {greeting}
          </h1>
        </div>
      </div>

      {/* Up Next Card */}
      <Link to="/exercises" style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', transition: 'background-color 0.15s', textDecoration: 'none' }}>
        <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: 'var(--surface-muted)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
          💪
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Up next · Workout
          </p>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx-primary)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Start your first workout
          </p>
          <p style={{ fontSize: '12px', color: 'var(--tx-muted)', margin: '2px 0 0 0' }}>
            Browse exercises to begin
          </p>
        </div>
      </Link>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500 }}>Week</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)', opacity: 0.7 }}>
              <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
              <path d="m2.5 21.5 1.4-1.4"></path>
              <path d="m20.1 3.9 1.4-1.4"></path>
              <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>
              <path d="m9.6 14.4 4.8-4.8"></path>
            </svg>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>{Math.max(currentProgramWeek(), 1)}</p>
          <p style={{ fontSize: '10px', color: 'var(--tx-muted)', margin: 0 }}>of 19</p>
        </div>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500 }}>Cals</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)', opacity: 0.7 }}>
              <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"></path>
            </svg>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>{todayBurn.toLocaleString()}</p>
          <p style={{ fontSize: '10px', color: 'var(--tx-muted)', margin: 0 }}>kcal burned</p>
        </div>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500 }}>Protein</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)', opacity: 0.7 }}>
              <path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3"></path>
              <path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"></path>
              <circle cx="12.5" cy="8.5" r="2.5"></circle>
            </svg>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>
            {Math.round(nutritionToday.protein)}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--tx-muted)', marginLeft: '2px' }}>g</span>
          </p>
          <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((nutritionToday.protein / 150) * 100, 100)}%`, background: '#f59e0b', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      </div>

      {/* Volume Trend -> WHOOP daily strain */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)', flexShrink: 0 }}>
              <path d="M16 7h6v6"></path>
              <path d="m22 7-8.5 8.5-5-5L2 17"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Volume Trend</h2>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', gap: '4px', backgroundColor: 'var(--surface-overlay)', borderRadius: '8px', padding: '4px' }}>
            {[7, 14, 30].map((n) => {
              const active = strainRange === n
              return (
                <button
                  key={n}
                  onClick={() => setStrainRange(n)}
                  style={{ padding: '6px 12px', border: active ? '1px solid var(--surface-border)' : 'none', backgroundColor: active ? 'var(--surface-raised)' : 'transparent', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: active ? 'var(--tx-primary)' : 'var(--tx-muted)', cursor: 'pointer', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
        {strainData.length === 0 ? (
          <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface-base)', borderRadius: '8px', color: 'var(--tx-muted)', fontSize: '0.85rem' }}>
            No strain data yet
          </div>
        ) : (() => {
          const maxStrain = Math.max(...strainData.map(s => s.strain), 1)
          const avg = strainData.reduce((a, s) => a + s.strain, 0) / strainData.length
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '110px' }}>
                {strainData.map((d, i) => {
                  const pct = Math.max((d.strain / maxStrain) * 100, 3)
                  const color = d.strain >= 18 ? '#ef4444' : d.strain >= 14 ? '#f59e0b' : d.strain >= 10 ? '#00b8d9' : '#3b82f6'
                  return (
                    <div
                      key={i}
                      title={`${d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - strain ${d.strain.toFixed(1)}`}
                      style={{ flex: 1, height: `${pct}%`, minHeight: '3px', background: color, borderRadius: '3px 3px 0 0', transition: 'height 0.3s ease', cursor: 'pointer' }}
                    />
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--tx-muted)' }}>
                <span>{strainData[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span>avg strain {avg.toFixed(1)}</span>
                <span>{strainData[strainData.length - 1].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </>
          )
        })()}
      </div>

      {/* Consistency Heatmap */}
      <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)' }}>
              <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Consistency</h2>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>Last 2 months</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--tx-muted)' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
              <span key={i} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{label}</span>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
            {(() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const dayOfWeek = today.getDay()
              const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
              const firstMonday = new Date(today)
              firstMonday.setDate(today.getDate() - daysFromMon - (8 * 7))
              const windowStart = new Date(today)
              windowStart.setDate(today.getDate() - 59)

              return Array.from({ length: 9 }).map((_, weekIndex) => (
                <div key={weekIndex} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const cellDate = new Date(firstMonday)
                    cellDate.setDate(firstMonday.getDate() + (weekIndex * 7) + dayIndex)
                    const dayString = toLocalDateStr(cellDate)
                    const entries = workoutsByDay[dayString] || []
                    const isWorkoutDay = entries.length > 0
                    const isFutureDay = cellDate > today
                    const isOutOfWindow = cellDate < windowStart

                    const maxStrain = entries.reduce((m, e) => (e.strain != null && e.strain > m ? e.strain : m), 0)

                    let background
                    if (isFutureDay) background = 'rgba(22, 34, 64, 0.3)'
                    else if (isOutOfWindow) background = 'rgba(22, 34, 64, 0.15)'
                    else if (isWorkoutDay) {
                      if (maxStrain >= 18) background = '#ef4444'
                      else if (maxStrain >= 14) background = '#f59e0b'
                      else if (maxStrain >= 10) background = '#00b8d9'
                      else if (maxStrain > 0) background = 'rgba(0, 184, 217, 0.45)'
                      else background = '#00b8d9'
                    } else background = 'rgba(22, 34, 64, 0.5)'

                    const tooltip = isWorkoutDay
                      ? `${dayString}\n` + entries.map(e => `${e.sport_name}${e.strain != null ? ` · Strain ${e.strain.toFixed(1)}` : ''}`).join('\n')
                      : dayString

                    return (
                      <div
                        key={dayIndex}
                        title={tooltip}
                        style={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: '4px',
                          background,
                          cursor: 'pointer'
                        }}
                      />
                    )
                  })}
                </div>
              ))
            })()}
          </div>
        </div>
      </div>

      {/* Recent Workout + Nutrition */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Recent Workout</h3>
            <Link to="/workouts" style={{ fontSize: '12px', color: 'var(--brand-400)', textDecoration: 'none', transition: 'color 0.15s ease' }}>All →</Link>
          </div>
          {lastWorkout ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto', borderRadius: '50%', backgroundColor: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                {sportEmoji(lastWorkout.sport_name)}
              </div>
              <div>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)', margin: 0 }}>
                  {lastWorkout.sport_name || 'Workout'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--tx-muted)', margin: '4px 0 0 0' }}>
                  {new Date(lastWorkout.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Strain</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>
                    {lastWorkout.strain ? lastWorkout.strain.toFixed(1) : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Calories</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>
                    {lastWorkout.calories_kcal ? Math.round(lastWorkout.calories_kcal) : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 16px 0', color: 'var(--tx-muted)', fontSize: '0.9rem' }}>No workouts logged yet</p>
              <Link to="/exercises" style={{ display: 'inline-block', padding: '8px 16px', backgroundColor: 'var(--brand-500)', color: 'white', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', transition: 'background-color 0.15s ease' }}>Start Your First Workout</Link>
            </div>
          )}
        </div>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Today's Nutrition</h3>
            <Link to="/food" style={{ fontSize: '12px', color: 'var(--brand-400)', textDecoration: 'none', transition: 'color 0.15s ease' }}>Log →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1 }}>{Math.round(nutritionToday.calories)}</span>
                <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>/ 2000 kcal</span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden', marginTop: '12px' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.calories / 2000) * 100, 100)}%`, background: '#00b8d9', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Protein</span>
                <span style={{ color: 'var(--tx-primary)', fontWeight: 600 }}>{Math.round(nutritionToday.protein)}g <span style={{ opacity: 0.6 }}>/ 150g</span></span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.protein / 150) * 100, 100)}%`, background: '#3b82f6', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Carbs</span>
                <span style={{ color: 'var(--tx-primary)', fontWeight: 600 }}>{Math.round(nutritionToday.carbs)}g <span style={{ opacity: 0.6 }}>/ 250g</span></span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.carbs / 250) * 100, 100)}%`, background: '#f59e0b', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Fat</span>
                <span style={{ color: 'var(--tx-primary)', fontWeight: 600 }}>{Math.round(nutritionToday.fat)}g <span style={{ opacity: 0.6 }}>/ 65g</span></span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.fat / 65) * 100, 100)}%`, background: '#8b5cf6', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Muscle Balance from completed workouts */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)', flexShrink: 0 }}>
              <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
              <path d="m2.5 21.5 1.4-1.4"></path>
              <path d="m20.1 3.9 1.4-1.4"></path>
              <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>
              <path d="m9.6 14.4 4.8-4.8"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Muscle Balance</h2>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>{completedCount} workout{completedCount !== 1 ? 's' : ''}</span>
        </div>
        {muscleBalance.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--tx-muted)', margin: '4px 0' }}>No completed workouts yet. Log one on the Workouts tab.</p>
        ) : (() => {
          const COLORS = ['#818cf8', '#6ee7b7', '#f87171', '#34d399', '#4ade80', '#6366f1', '#a78bfa', '#38bdf8', '#f59e0b', '#00b8d9', '#e879f9', '#fb923c']
          const total = muscleBalance.reduce((a, m) => a + m.count, 0) || 1
          const max = Math.max(...muscleBalance.map((m) => m.count), 1)
          const R = 42
          const C = 2 * Math.PI * R
          let acc = 0
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
                <g transform="rotate(-90 56 56)">
                  {muscleBalance.map((m, i) => {
                    const len = (m.count / total) * C
                    const el = (
                      <circle key={m.muscle} cx="56" cy="56" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
                    )
                    acc += len
                    return el
                  })}
                </g>
              </svg>
              <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {muscleBalance.map((m, i) => (
                  <div key={m.muscle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, color: 'var(--tx-secondary)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.muscle}</span>
                      <span style={{ color: 'var(--tx-muted)', fontVariantNumeric: 'tabular-nums' }}>{m.count}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--surface-muted)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(m.count / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length], borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Weight */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)', flexShrink: 0 }}>
              <path d="M12 3v18"></path>
              <path d="m3 7 3 8a5 5 0 0 0 6 0l3-8"></path>
              <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"></path>
              <path d="m19 7 3 8a5 5 0 0 1-6 0l-3-8"></path>
              <path d="M7 21h10"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Weight</h2>
          </div>
          <Link to="/weight" style={{ fontSize: '12px', color: 'var(--brand-400)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.15s ease' }}>
            View
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {weightData.length > 0 ? parseFloat(weightData[weightData.length - 1].weight).toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--tx-muted)' }}>kg</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>
            {weightData.length >= 2 ? (
              <>
                7d · {(() => {
                  const latest = parseFloat(weightData[weightData.length - 1].weight)
                  const oldest = parseFloat(weightData[0].weight)
                  const change = latest - oldest
                  return change === 0 ? 'no change' : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`
                })()}
              </>
            ) : '7d · no data'}
          </span>
        </div>
        <div style={{ width: '100%', height: '48px', position: 'relative' }}>
          <svg
            width="100%"
            height="48"
            viewBox="0 0 1000 48"
            style={{ width: '100%', height: '100%' }}
            onMouseLeave={() => setWeightHover(null)}
          >
            <defs>
              <clipPath id="weight-clip">
                <rect x="0" y="0" width="1000" height="48"></rect>
              </clipPath>
            </defs>
            <path
              d={weightData.map((d, i) => {
                const x = (i / (weightData.length - 1)) * 1000
                const y = 48 - ((d.weight - minWeight) / weightRange) * 38 - 5
                return `${i === 0 ? 'M' : 'L'}${x},${y}`
              }).join(' ')}
              stroke="#6366f1"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {weightData.map((d, i) => {
              const x = (i / (weightData.length - 1)) * 1000
              const y = 48 - ((d.weight - minWeight) / weightRange) * 38 - 5
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={weightHover === i ? "4" : "0"}
                  fill="#6366f1"
                  onMouseEnter={() => setWeightHover(i)}
                />
              )
            })}
            {weightData.map((d, i) => {
              const x = (i / (weightData.length - 1)) * 1000
              const y = 48 - ((d.weight - minWeight) / weightRange) * 38 - 5
              return (
                <rect
                  key={`hover-${i}`}
                  x={x - 30}
                  y="0"
                  width="60"
                  height="48"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setWeightHover(i)}
                />
              )
            })}
          </svg>
          {weightHover !== null && (
            <div style={{
              position: 'absolute',
              left: `${(weightHover / (weightData.length - 1)) * 100}%`,
              top: `${48 - ((weightData[weightHover].weight - minWeight) / weightRange) * 38 - 5}px`,
              transform: 'translate(-50%, -100%)',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--surface-border)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              color: 'var(--tx-primary)',
              whiteSpace: 'nowrap',
              marginTop: '-8px',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              <div style={{ fontWeight: 600 }}>{weightData[weightHover].date}</div>
              <div style={{ color: '#6366f1', fontWeight: 700 }}>Weight: {weightData[weightHover].weight} kg</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
