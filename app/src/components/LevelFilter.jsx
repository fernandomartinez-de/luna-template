const LEVELS = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'expert', label: 'Expert' }
]

export default function LevelFilter({ selected, onChange }) {
  return (
    <div className="filter-chips" role="tablist" aria-label="Level filter">
      <button
        type="button"
        role="tab"
        aria-selected={selected === 'all'}
        className={`filter-chip ${selected === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
      >
        All Levels
      </button>
      {LEVELS.map((level) => (
        <button
          key={level.key}
          type="button"
          role="tab"
          aria-selected={selected === level.key}
          className={`filter-chip ${selected === level.key ? 'active' : ''}`}
          onClick={() => onChange(level.key)}
        >
          {level.label}
        </button>
      ))}
    </div>
  )
}
