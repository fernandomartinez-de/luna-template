import { LIFT_UNIT } from '../config.js'

export default function PersonalRecord({ exerciseId, record }) {
  if (!record) {
    return (
      <div className="pr-card">
        <div className="pr-header">
          <span className="pr-icon">🏆</span>
          <span className="pr-title">YOUR BEST</span>
        </div>
        <div className="pr-empty">No lifts logged yet</div>
      </div>
    )
  }

  const formattedDate = new Date(record.logged_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div className="pr-card">
      <div className="pr-header">
        <span className="pr-icon">🏆</span>
        <span className="pr-title">YOUR BEST</span>
      </div>
      <div className="pr-value">
        {record.weight} <span className="pr-unit">{LIFT_UNIT}</span> x {record.reps} reps
      </div>
      <div className="pr-meta">
        Est. 1RM: {record.estimated_1rm} {LIFT_UNIT} • {formattedDate}
      </div>
    </div>
  )
}
