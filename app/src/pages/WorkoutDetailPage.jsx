import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import LogWorkoutModal from '../components/LogWorkoutModal.jsx'
import ExercisePickerModal from '../components/ExercisePickerModal.jsx'
import { LIFT_UNIT, LIFT_STEP } from '../config.js'

function getSetArray(we) {
  if (Array.isArray(we.set_details) && we.set_details.length > 0) {
    return we.set_details.map((s) => ({
      reps: s && s.reps != null && s.reps !== '' ? Number(s.reps) : 0,
      weight: s && s.weight != null && s.weight !== '' ? Number(s.weight) : null
    }))
  }
  const n = Math.max(Number(we.sets) || 0, 0)
  if (n === 0) return []
  const reps = Number(we.reps) || 0
  const weight = we.weight != null && we.weight !== '' ? Number(we.weight) : null
  return Array.from({ length: n }, () => ({ reps, weight }))
}

export default function WorkoutDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '', rows: [], removedIds: [] })
  const [editError, setEditError] = useState(null)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: w, error: we } = await supabase.from('workouts').select('*').eq('id', id).single()
        if (we) throw we
        const { data: ex, error: ee } = await supabase
          .from('workout_exercises')
          .select('*, exercises(*)')
          .eq('workout_id', id)
          .order('order_index', { ascending: true })
        if (ee) throw ee
        if (!cancelled) { setWorkout(w); setExercises(ex || []) }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  function beginEdit() {
    setDraft({
      name: workout.name || '',
      description: workout.description || '',
      removedIds: [],
      rows: exercises.map((we) => ({
        id: we.id,
        exercise_name: (we.exercises && we.exercises.name) || 'Exercise',
        setArr: getSetArray(we).map((s) => ({
          reps: s.reps ? String(s.reps) : '',
          weight: s.weight != null ? String(s.weight) : ''
        }))
      }))
    })
    setEditError(null)
    setEditing(true)
  }

  function removeExercise(rowKey) {
    if (!confirm('Remove this exercise from the workout?')) return
    setDraft((prev) => {
      const row = prev.rows.find((r) => (r.id || r._tempId) === rowKey)
      const isNew = row && row._new
      return {
        ...prev,
        rows: prev.rows.filter((r) => (r.id || r._tempId) !== rowKey),
        // Only track for deletion if it's a persisted row (has a real id).
        removedIds: isNew ? prev.removedIds : [...prev.removedIds, rowKey]
      }
    })
  }

  function cancelEdit() {
    setEditing(false)
    setEditError(null)
  }

  function addExercisesFromPicker(picked) {
    // Each `picked` entry is a full exercise row from the modal.
    setDraft((prev) => {
      const startOrder = Math.max(
        0,
        exercises.length,
        ...prev.rows.map((r) => r._orderIndex || 0)
      )
      const newRows = picked.map((ex, i) => ({
        _new: true,
        _tempId: `new-${Date.now()}-${i}`,
        _exercise: {
          id: ex.id,
          name: ex.name,
          muscle_group: ex.muscle_group,
          images: ex.images
        },
        _orderIndex: startOrder + i + 1,
        exercise_name: ex.name,
        setArr: [{ reps: '10', weight: '' }]
      }))
      return { ...prev, rows: [...prev.rows, ...newRows] }
    })
    setShowPicker(false)
  }

  function updateSet(rowKey, index, field, value) {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        if ((r.id || r._tempId) !== rowKey) return r
        const nextArr = r.setArr.map((s, i) => (i === index ? { ...s, [field]: value } : s))
        return { ...r, setArr: nextArr }
      })
    }))
  }

  function addSet(rowKey) {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        if ((r.id || r._tempId) !== rowKey) return r
        const last = r.setArr[r.setArr.length - 1]
        const seed = last ? { reps: last.reps, weight: last.weight } : { reps: '', weight: '' }
        return { ...r, setArr: [...r.setArr, seed] }
      })
    }))
  }

  function removeSet(rowKey, index) {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => ((r.id || r._tempId) !== rowKey ? r : { ...r, setArr: r.setArr.filter((_, i) => i !== index) }))
    }))
  }

  async function saveEdit() {
    setSaving(true)
    setEditError(null)
    try {
      const { error: wErr } = await supabase
        .from('workouts')
        .update({ name: draft.name, description: draft.description })
        .eq('id', id)
      if (wErr) throw wErr

      if (draft.removedIds.length > 0) {
        const { error: dErr } = await supabase
          .from('workout_exercises')
          .delete()
          .in('id', draft.removedIds)
        if (dErr) throw dErr
      }

      // Update existing rows (those with a real id)
      const existingRows = draft.rows.filter((r) => r.id && !r._new)
      for (const r of existingRows) {
        const cleanSets = r.setArr.map((s) => ({
          reps: s.reps === '' ? null : Number(s.reps),
          weight: s.weight === '' ? null : Number(s.weight)
        }))
        const first = cleanSets[0] || { reps: null, weight: null }
        const { error: rErr } = await supabase
          .from('workout_exercises')
          .update({
            sets: cleanSets.length || null,
            reps: first.reps,
            weight: first.weight,
            set_details: cleanSets
          })
          .eq('id', r.id)
        if (rErr) throw rErr
      }

      // Insert new rows (added via the Add Exercises picker)
      const newRows = draft.rows.filter((r) => r._new)
      if (newRows.length > 0) {
        const maxExisting = exercises.reduce((m, we) => Math.max(m, we.order_index || 0), 0)
        const payload = newRows.map((r, i) => {
          const cleanSets = r.setArr.map((s) => ({
            reps: s.reps === '' ? null : Number(s.reps),
            weight: s.weight === '' ? null : Number(s.weight)
          }))
          const first = cleanSets[0] || { reps: null, weight: null }
          return {
            workout_id: id,
            exercise_id: r._exercise.id,
            order_index: maxExisting + i + 1,
            sets: cleanSets.length || null,
            reps: first.reps,
            weight: first.weight,
            set_details: cleanSets
          }
        })
        const { error: iErr } = await supabase.from('workout_exercises').insert(payload)
        if (iErr) throw iErr
      }

      const { data: w2 } = await supabase.from('workouts').select('*').eq('id', id).single()
      const { data: ex2 } = await supabase
        .from('workout_exercises')
        .select('*, exercises(*)')
        .eq('workout_id', id)
        .order('order_index', { ascending: true })
      setWorkout(w2 || workout)
      setExercises(ex2 || exercises)
      setEditing(false)
    } catch (err) {
      setEditError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this workout?')) return
    setDeleting(true)
    const { error: err } = await supabase.from('workouts').delete().eq('id', id)
    if (err) { alert('Failed to delete: ' + err.message); setDeleting(false); return }
    navigate('/workouts')
  }

  async function handleCopy() {
    setCopying(true)
    try {
      const { data: newW, error: nwErr } = await supabase
        .from('workouts')
        .insert({ name: `${workout.name} (Copy)`, description: workout.description || null })
        .select()
        .single()
      if (nwErr) throw nwErr

      if (exercises.length > 0) {
        const payload = exercises.map((we) => ({
          workout_id: newW.id,
          exercise_id: (we.exercises && we.exercises.id) || we.exercise_id,
          order_index: we.order_index,
          sets: we.sets,
          reps: we.reps,
          weight: we.weight,
          set_details: we.set_details
        }))
        const { error: cErr } = await supabase.from('workout_exercises').insert(payload)
        if (cErr) throw cErr
      }

      navigate(`/workout/${newW.id}`)
    } catch (err) {
      alert('Failed to copy: ' + (err.message || String(err)))
    } finally {
      setCopying(false)
    }
  }

  function handleLogged() {
    setShowLog(false)
    navigate('/workouts')
  }

  if (loading) return <div className="status-block">Loading workout...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>
  if (!workout) return <div className="status-block">Workout not found.</div>

  const perExerciseSets = exercises.map((we) => getSetArray(we))
  const totalSets = perExerciseSets.reduce((a, arr) => a + arr.length, 0)
  const totalVolume = perExerciseSets.reduce((a, arr) =>
    a + arr.reduce((b, s) => b + (s.weight != null ? s.reps * s.weight : 0), 0), 0
  )
  const dateLong = new Date(workout.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const heroImg = exercises[0] && exercises[0].exercises && exercises[0].exercises.images ? exercises[0].exercises.images[0] : null

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '14px', padding: '16px' }
  const thumb = (size) => ({ width: `${size}px`, height: `${size}px`, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' })
  const img = { width: '100%', height: '100%', objectFit: 'cover' }
  const muscleTag = { fontSize: '11px', color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', borderRadius: '6px', padding: '2px 8px', textTransform: 'capitalize', fontWeight: 600 }
  const chip = { fontSize: '12px', color: 'var(--brand-400)', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '5px 10px', fontWeight: 600, whiteSpace: 'nowrap' }
  const stat = (label, value) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{value}</div>
    </div>
  )
  const numInput = {
    width: '52px', textAlign: 'center', fontSize: '15px', padding: '5px 4px',
    borderRadius: '6px', border: '1px solid var(--surface-border)',
    background: 'var(--surface-base)', color: 'var(--tx-primary)'
  }
  const editBtn = { border: '1px solid var(--surface-border)', background: 'var(--surface-raised)', color: 'var(--brand-400)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
  const primaryBtn = { border: 'none', background: 'var(--brand-500)', color: 'white', borderRadius: '8px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
  const ghostBtn = { border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--tx-secondary)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
  const addSetBtn = { border: '1px dashed var(--surface-border)', background: 'transparent', color: 'var(--brand-400)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', width: '100%' }
  const setRow = { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '6px 10px' }
  const xSet = { border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '2px 4px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <Link to="/workouts" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx-secondary)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>← Workouts</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {editing ? (
            <>
              <button onClick={cancelEdit} disabled={saving} style={ghostBtn}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={primaryBtn}>{saving ? 'Saving...' : 'Save'}</button>
            </>
          ) : (
            <>
              <button onClick={beginEdit} style={editBtn}>✎ Edit</button>
              <button onClick={handleCopy} disabled={copying} style={editBtn}>{copying ? 'Copying...' : '⧉ Copy'}</button>
              <button onClick={() => setShowLog(true)} style={primaryBtn}>✓ Log</button>
              <button onClick={handleDelete} disabled={deleting} title="Delete workout" style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>🗑</button>
            </>
          )}
        </div>
      </div>

      {editing && editError && (
        <div className="status-block error">{editError}</div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={thumb(64)}>
            {heroImg ? <img src={heroImg} alt="" style={img} onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <span style={{ color: 'var(--tx-muted)' }}>◐</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {editing ? (
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="Workout name"
                style={{ width: '100%', fontSize: '1.2rem', fontWeight: 700, color: 'var(--tx-primary)', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '6px 10px' }}
              />
            ) : (
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{workout.name}</h1>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--tx-muted)', marginTop: '2px' }}>{dateLong}</div>
          </div>
        </div>
        {editing ? (
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            style={{ marginTop: '12px', width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem', color: 'var(--tx-primary)', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '8px 10px' }}
          />
        ) : (
          workout.description && <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', margin: '12px 0 0 0' }}>{workout.description}</p>
        )}
        <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '14px', paddingTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {stat('Exercises', exercises.length)}
          {stat('Sets', totalSets)}
          {stat('Volume', totalVolume > 0 ? `${totalVolume.toLocaleString()} ${LIFT_UNIT}` : '—')}
        </div>
      </div>

      {exercises.map((we, exIdx) => {
        if (editing && draft.removedIds.includes(we.id)) return null
        // Also hide if user removed a row that was originally persisted but
        // then dropped in this edit session.
        if (editing && !draft.rows.find((r) => r.id === we.id)) return null
        const ex = we.exercises || {}
        const sArr = perExerciseSets[exIdx]
        const setCount = sArr.length
        const vol = sArr.reduce((a, s) => a + (s.weight != null ? s.reps * s.weight : 0), 0)
        const best = sArr.reduce((m, s) => (s.weight != null && s.weight > m ? s.weight : m), 0)
        const exImg = ex.images ? ex.images[0] : null
        const draftRow = editing ? draft.rows.find((r) => r.id === we.id) : null

        const HeaderWrap = editing ? 'div' : Link
        const headerProps = editing
          ? { style: { display: 'flex', alignItems: 'center', gap: '12px' } }
          : { to: `/exercise/${ex.id}`, style: { display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' } }

        return (
          <div key={we.id} style={card}>
            <HeaderWrap {...headerProps}>
              <div style={thumb(48)}>
                {exImg ? <img src={exImg} alt="" style={img} onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <span style={{ color: 'var(--tx-muted)' }}>◐</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name || 'Exercise'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  {ex.muscle_group && <span style={muscleTag}>{ex.muscle_group}</span>}
                  {!editing && (
                    <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>{setCount} sets{vol > 0 ? ` · ${vol.toLocaleString()} ${LIFT_UNIT}` : ''}</span>
                  )}
                </div>
              </div>
              {!editing && best > 0 && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '9px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-400)' }}>{best} {LIFT_UNIT}</div>
                </div>
              )}
              {!editing && <span style={{ color: 'var(--tx-muted)', flexShrink: 0, fontSize: '18px' }}>›</span>}
            </HeaderWrap>

            {editing ? (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                  <button type="button" onClick={() => removeExercise(we.id)} style={{ border: '1px solid var(--surface-border)', background: 'transparent', color: '#ef4444', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    − Remove exercise
                  </button>
                </div>
                {draftRow && draftRow.setArr.map((s, i) => (
                  <div key={i} style={setRow}>
                    <span style={{ fontSize: '11px', color: 'var(--tx-muted)', width: '38px', flexShrink: 0 }}>Set {i + 1}</span>
                    <input type="number" min="0" max="100" placeholder="reps" value={s.reps} onChange={(e) => updateSet(we.id, i, 'reps', e.target.value)} style={numInput} />
                    <span style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>×</span>
                    <input type="number" min="0" step={LIFT_STEP} placeholder={LIFT_UNIT} value={s.weight} onChange={(e) => updateSet(we.id, i, 'weight', e.target.value)} style={{ ...numInput, width: '64px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--tx-muted)', flex: 1 }}>{LIFT_UNIT}</span>
                    <button type="button" onClick={() => removeSet(we.id, i)} title="Remove set" style={xSet}>×</button>
                  </div>
                ))}
                <button type="button" onClick={() => addSet(we.id)} style={addSetBtn}>+ Add set</button>
              </div>
            ) : (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {sArr.length === 0 ? (
                  <span style={chip}>—</span>
                ) : (
                  sArr.map((s, i) => (
                    <span key={i} style={chip}>{s.reps || '—'}{s.weight != null ? ` × ${s.weight} ${LIFT_UNIT}` : ' reps'}</span>
                  ))
                )}
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--tx-muted)' }}>⏱ 90s</span>
              </div>
            )}
          </div>
        )
      })}

      {editing && draft.rows.filter((r) => r._new).map((r) => {
        const ex = r._exercise || {}
        const exImg = ex.images ? ex.images[0] : null
        const rowKey = r._tempId
        return (
          <div key={rowKey} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={thumb(48)}>
                {exImg ? <img src={exImg} alt="" style={img} onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <span style={{ color: 'var(--tx-muted)' }}>◐</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name || 'Exercise'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  {ex.muscle_group && <span style={muscleTag}>{ex.muscle_group}</span>}
                  <span style={{ fontSize: '11px', color: 'var(--brand-400)', fontWeight: 600 }}>NEW</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                <button type="button" onClick={() => removeExercise(rowKey)} style={{ border: '1px solid var(--surface-border)', background: 'transparent', color: '#ef4444', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  − Remove exercise
                </button>
              </div>
              {r.setArr.map((s, i) => (
                <div key={i} style={setRow}>
                  <span style={{ fontSize: '11px', color: 'var(--tx-muted)', width: '38px', flexShrink: 0 }}>Set {i + 1}</span>
                  <input type="number" min="0" max="100" placeholder="reps" value={s.reps} onChange={(e) => updateSet(rowKey, i, 'reps', e.target.value)} style={numInput} />
                  <span style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>×</span>
                  <input type="number" min="0" step={LIFT_STEP} placeholder={LIFT_UNIT} value={s.weight} onChange={(e) => updateSet(rowKey, i, 'weight', e.target.value)} style={{ ...numInput, width: '64px' }} />
                  <span style={{ fontSize: '11px', color: 'var(--tx-muted)', flex: 1 }}>{LIFT_UNIT}</span>
                  <button type="button" onClick={() => removeSet(rowKey, i)} title="Remove set" style={xSet}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => addSet(rowKey)} style={addSetBtn}>+ Add set</button>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => {
          // If we aren't in edit mode yet, enter it now — the picker only
          // makes sense while editing.
          if (!editing) beginEdit()
          setShowPicker(true)
        }}
        style={{
          border: '1px dashed var(--brand-400)',
          background: 'rgba(0, 184, 217, 0.05)',
          color: 'var(--brand-400)',
          borderRadius: '12px',
          padding: '14px',
          fontSize: '0.95rem',
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%'
        }}
      >+ Add exercises</button>

      {showPicker && (
        <ExercisePickerModal
          excludedIds={draft.rows
            .filter((r) => !r._new)
            .map((r) => {
              const we = exercises.find((e) => e.id === r.id)
              return we && we.exercises ? we.exercises.id : null
            })
            .filter(Boolean)}
          onCancel={() => setShowPicker(false)}
          onConfirm={addExercisesFromPicker}
        />
      )}

      {showLog && (
        <LogWorkoutModal
          workout={workout}
          exercises={exercises}
          onClose={() => setShowLog(false)}
          onLogged={handleLogged}
        />
      )}
    </div>
  )
}
