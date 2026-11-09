import { MUSCLE_GROUPS } from '../utils/muscleMapping.js'

export default function MuscleFilter({ selected, onChange }) {
  return (
    <div className="filter-chips" role="tablist" aria-label="Muscle group filter">
      <button
        type="button"
        role="tab"
        aria-selected={selected === 'all'}
        className={`filter-chip ${selected === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
      >
        All
      </button>
      {MUSCLE_GROUPS.map((mg) => (
        <button
          key={mg.key}
          type="button"
          role="tab"
          aria-selected={selected === mg.key}
          className={`filter-chip ${selected === mg.key ? 'active' : ''}`}
          onClick={() => onChange(mg.key)}
        >
          {mg.label}
        </button>
      ))}
    </div>
  )
}
