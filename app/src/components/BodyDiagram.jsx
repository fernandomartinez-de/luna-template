import Model from 'react-body-highlighter'
import { buildExerciseModel } from '../utils/muscleMapping.js'

export default function BodyDiagram({ exercise }) {
  const data = buildExerciseModel(exercise)

  // [secondary_color, primary_color] - frequency 1 uses first, frequency 2 uses second
  const highlightedColors = ['#0e7490', '#22d3ee']

  const hasSecondary = exercise.secondary_muscles && exercise.secondary_muscles.length > 0

  return (
    <div className="body-diagram-wrapper">
      <div className="body-diagram-figures">
        <div className="body-diagram-figure">
          <Model
            data={data}
            type="anterior"
            style={{ width: '100%' }}
            highlightedColors={highlightedColors}
            bodyColor="#334155"
          />
          <span className="body-diagram-caption">Front</span>
        </div>
        <div className="body-diagram-figure">
          <Model
            data={data}
            type="posterior"
            style={{ width: '100%' }}
            highlightedColors={highlightedColors}
            bodyColor="#334155"
          />
          <span className="body-diagram-caption">Back</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        marginTop: '16px',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#22d3ee'
          }}></div>
          <span style={{ color: '#94a3b8' }}>Primary</span>
        </div>
        {hasSecondary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#0e7490'
            }}></div>
            <span style={{ color: '#94a3b8' }}>Secondary</span>
          </div>
        )}
      </div>
    </div>
  )
}
