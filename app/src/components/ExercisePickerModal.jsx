import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'

/**
 * Full-screen exercise picker with checkbox multi-select. Used when editing
 * a saved workout: pick a bunch of exercises, hit "Add N", they land in the
 * edit draft as new pending rows.
 */
export default function ExercisePickerModal({ excludedIds = [], onCancel, onConfirm }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('all')
  const [picked, setPicked] = useState({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const batchSize = 1000
      let from = 0
      const all = []
      try {
        while (true) {
          const { data, error: err } = await supabase
            .from('exercises')
            .select('id, name, muscle_group, equipment, level, images')
            .order('name', { ascending: true })
            .range(from, from + batchSize - 1)
          if (err) throw err
          if (!data || data.length === 0) break
          all.push(...data)
          if (data.length < batchSize) break
          from += batchSize
        }
        if (!cancelled) setExercises(all)
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds])

  const muscles = useMemo(() => {
    const s = new Set()
    exercises.forEach((e) => { if (e.muscle_group) s.add(e.muscle_group) })
    return ['all', ...Array.from(s).sort()]
  }, [exercises])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter((e) => {
      if (excludedSet.has(e.id)) return false
      if (muscle !== 'all' && e.muscle_group !== muscle) return false
      if (q && !e.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [exercises, query, muscle, excludedSet])

  const pickedList = useMemo(() =>
    exercises.filter((e) => picked[e.id]),
    [exercises, picked]
  )

  function toggle(id) {
    setPicked((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]; else next[id] = true
      return next
    })
  }

  function confirm() {
    if (pickedList.length === 0) return
    onConfirm(pickedList)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0, 0, 0, 0.72)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      padding: 'calc(var(--sa-top) + 12px) calc(var(--sa-right) + 12px) calc(var(--sa-bottom) + 12px) calc(var(--sa-left) + 12px)'
    }}>
      <div style={{
        background: 'var(--surface-raised)', border: '1px solid var(--surface-border)',
        borderRadius: '16px', width: '100%', maxWidth: '640px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)' }}>Add exercises</h2>
          <button onClick={onCancel} style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>×</button>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--surface-border)' }}>
          <input
            type="search"
            placeholder="Search exercises..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)' }}
          />
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {muscles.map((m) => (
              <button
                key={m}
                onClick={() => setMuscle(m)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: '1px solid var(--surface-border)',
                  background: muscle === m ? 'var(--brand-500)' : 'transparent',
                  color: muscle === m ? '#0a0f1f' : 'var(--tx-secondary)',
                  fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  textTransform: 'capitalize'
                }}
              >{m === 'all' ? 'All' : m}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '8px 16px 16px' }}>
          {loading && <div style={{ color: 'var(--tx-muted)', padding: '20px 0', textAlign: 'center' }}>Loading exercises...</div>}
          {error && <div style={{ color: '#ef4444', padding: '20px 0' }}>Error: {error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ color: 'var(--tx-muted)', padding: '20px 0', textAlign: 'center' }}>No exercises match.</div>
          )}
          {filtered.map((e) => {
            const active = !!picked[e.id]
            const img = e.images && e.images[0]
            return (
              <button
                key={e.id}
                onClick={() => toggle(e.id)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px', marginBottom: '6px',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--brand-500)' : '1px solid var(--surface-border)',
                  background: active ? 'rgba(0, 184, 217, 0.08)' : 'var(--surface-base)',
                  color: 'var(--tx-primary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: '2px solid ' + (active ? 'var(--brand-500)' : 'var(--surface-border)'), background: active ? 'var(--brand-500)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {active && <span style={{ color: '#0a0f1f', fontSize: '13px', fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(ev) => { ev.currentTarget.style.display = 'none' }} /> : <span style={{ color: 'var(--tx-muted)' }}>◐</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '2px', textTransform: 'capitalize' }}>{e.muscle_group || '—'}{e.equipment ? ` · ${e.equipment}` : ''}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface-base)' }}>
          <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--tx-secondary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={confirm}
            disabled={pickedList.length === 0}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '8px',
              border: 'none',
              background: pickedList.length === 0 ? 'var(--surface-muted)' : 'var(--brand-500)',
              color: pickedList.length === 0 ? 'var(--tx-muted)' : '#0a0f1f',
              fontWeight: 700, fontSize: '15px',
              cursor: pickedList.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >{pickedList.length === 0 ? 'Select exercises' : `Add ${pickedList.length} exercise${pickedList.length === 1 ? '' : 's'}`}</button>
        </div>
      </div>
    </div>
  )
}
