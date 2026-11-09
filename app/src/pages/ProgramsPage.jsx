import { useState } from 'react'
import { PROGRAM_START, currentProgramWeek, weekDateRange, fmtDateShort, fmtWeekRange } from '../utils/program.js'

export default function ProgramsPage() {
  const [expandedBlock, setExpandedBlock] = useState(null)
  const currentWeek = currentProgramWeek()
  const startDate = new Date(PROGRAM_START + 'T00:00:00')

  const weekPlan = [
    { wk: 1, block: 'Accumulation', phase: 'Build', primary: '4×5-8 RPE 7', accessory: '3×10-15 RPE 8' },
    { wk: 2, block: 'Accumulation', phase: 'Build', primary: '4×5-8 RPE 7-8', accessory: '4×10-15 RPE 8' },
    { wk: 3, block: 'Accumulation', phase: 'Build', primary: '4×5-8 RPE 8', accessory: '4×10-15 RPE 8' },
    { wk: 4, block: 'Accumulation', phase: 'Build', primary: '4×5-8 RPE 8', accessory: '4×10-15 RPE 8-9' },
    { wk: 5, block: 'Accumulation', phase: 'Deload', primary: '2×8 RPE 5-6', accessory: '2×12 RPE 5-6' },
    { wk: 6, block: 'Intensification', phase: 'Build', primary: '4×5-7 RPE 8', accessory: '3×10-15 RPE 8' },
    { wk: 7, block: 'Intensification', phase: 'Build', primary: '4×5-7 RPE 8', accessory: '3×10-15 RPE 8' },
    { wk: 8, block: 'Intensification', phase: 'Build', primary: '4×5-7 RPE 8', accessory: '3×10-12 RPE 8' },
    { wk: 9, block: 'Intensification', phase: 'Build', primary: '4×5-7 RPE 8', accessory: '3×10-12 RPE 8' },
    { wk: 10, block: 'Reaccumulation', phase: 'Deload', primary: '2×8 RPE 5-6', accessory: '2×12 RPE 5-6' },
    { wk: 11, block: 'Retention', phase: 'Build', primary: '4×5-8 RPE 8', accessory: '3×10-12 RPE 8' },
    { wk: 12, block: 'Retention', phase: 'Build', primary: '4×5-8 RPE 8', accessory: '3×10-12 RPE 8' },
    { wk: 13, block: 'Retention', phase: 'Build', primary: '3×5-8 RPE 8', accessory: '2×10-12 RPE 8' },
    { wk: 14, block: 'Retention', phase: 'Build', primary: '3×5-8 RPE 8', accessory: '2×10-12 RPE 8' },
    { wk: 15, block: 'Retention', phase: 'Deload', primary: '2×8 RPE 5-6', accessory: '2×12 RPE 5-6' },
    { wk: 16, block: 'Taper', phase: 'Build', primary: '3×5-8 RPE 8', accessory: '2×10-12 RPE 7-8' },
    { wk: 17, block: 'Taper', phase: 'Build', primary: '3×5-8 RPE 8', accessory: '2×10-12 RPE 7-8' },
    { wk: 18, block: 'Taper', phase: 'Build', primary: '3×5 RPE 8', accessory: '2×10 RPE 7-8' },
    { wk: 19, block: 'Taper', phase: 'Sharpen', primary: '2×3-5 RPE 8-7', accessory: '1×8-10 RPE 6' }
  ]

  const blocks = [
    {
      id: 1,
      name: 'BLOCK 1 - ACCUMULATION',
      weeks: 5,
      deloads: 1,
      sharpen: 0,
      description: 'Weeks 1 to 5: Accumulation. Accessory volume is highest and primary loads are establishing base. Moderate effort. The deficit is at its lowest here, use the best window to add a little load to the primary lifts.'
    },
    {
      id: 2,
      name: 'BLOCK 2 - INTENSIFICATION',
      weeks: 5,
      deloads: 1,
      sharpen: 0,
      description: 'Weeks 6 to 10: Intensification. Hold primaries heavy at RPE 8 in the 5 to 7 rep range; accessory volume stays moderate. The job is retention, not PRs.'
    },
    {
      id: 3,
      name: 'BLOCK 3 - RETENTION',
      weeks: 5,
      deloads: 1,
      sharpen: 0,
      description: 'Weeks 11 to 15: Retention. Primaries at RPE 8 for 5 to 8 reps. Start trimming accessory sets as the deficit deepens and recovery falls.'
    },
    {
      id: 4,
      name: 'BLOCK 4 - TAPER',
      weeks: 4,
      deloads: 0,
      sharpen: 1,
      description: 'Weeks 16 to 19: Taper. Hold primary intensity on fewer sets and keep accessories at minimum that maintains. Week 19 sharpens as you arrive lean with muscle intact.'
    }
  ]

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Status Banner */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', fontWeight: 600, marginBottom: '4px' }}>Program starts</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--tx-primary)' }}>
            {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', fontWeight: 600, marginBottom: '4px' }}>
            {currentWeek === 0 ? 'Starts soon' : `Week ${Math.min(currentWeek, 19)} of 19`}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--brand-400)', fontWeight: 600 }}>
            {currentWeek >= 1 && currentWeek <= 19 ? fmtWeekRange(currentWeek) : '—'}
          </div>
        </div>
      </div>

      {/* Program Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: '8px' }}>
          THE MESOCYCLE - 19 WEEKS
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.6', maxWidth: '900px' }}>
          <strong>How to read it:</strong> Primaries stay heavy but submaximal. RPE about 8 at 5 to 8 reps, across the whole cut. Never triples, never RPE 9: that is a strength peak, not a fat-loss accessory block. Accessory volume tapers across 19 weeks as the deficit deepens because recovery falls, deloads reset accumulated fatigue every ~5 weeks. Week 19 sharpens: volume and calories clean up, submaximal reps, no PR attempts.
        </p>
      </div>

      {/* Week Plan Table */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px', marginBottom: '24px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-primary)', marginBottom: '16px' }}>
          19-WEEK BLOCK PLAN
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--tx-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>WK</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--tx-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>DATES</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--tx-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>BLOCK</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--tx-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>PHASE</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--tx-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>PRIMARY</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--tx-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>ACCESSORY</th>
            </tr>
          </thead>
          <tbody>
            {weekPlan.map((week, i) => {
              const isCurrent = week.wk === currentWeek
              const range = weekDateRange(week.wk)
              return (
              <tr key={i} style={{ borderBottom: i < weekPlan.length - 1 ? '1px solid var(--surface-border)' : 'none', backgroundColor: isCurrent ? 'rgba(0, 184, 217, 0.08)' : 'transparent' }}>
                <td style={{ padding: '12px', color: isCurrent ? 'var(--brand-400)' : 'var(--tx-primary)', fontWeight: 700 }}>
                  {week.wk}{isCurrent ? ' •' : ''}
                </td>
                <td style={{ padding: '12px', color: 'var(--tx-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {fmtDateShort(range.start)} - {fmtDateShort(range.end)}
                </td>
                <td style={{ padding: '12px', color: 'var(--tx-secondary)' }}>{week.block}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: week.phase === 'Build' ? 'rgba(0, 184, 217, 0.15)' : week.phase === 'Deload' ? 'rgba(100, 116, 139, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: week.phase === 'Build' ? '#38d8fb' : week.phase === 'Deload' ? '#94a3b8' : '#fbbf24'
                  }}>
                    {week.phase}
                  </span>
                </td>
                <td style={{ padding: '12px', color: 'var(--tx-secondary)', fontVariantNumeric: 'tabular-nums' }}>{week.primary}</td>
                <td style={{ padding: '12px', color: 'var(--tx-secondary)', fontVariantNumeric: 'tabular-nums' }}>{week.accessory}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Blocks at a Glance */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-primary)', marginBottom: '16px' }}>
          BLOCKS AT A GLANCE
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {blocks.map(block => (
            <div
              key={block.id}
              style={{
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--surface-border)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: expandedBlock === block.id ? '12px' : '0' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx-primary)', marginBottom: '8px' }}>
                    {block.name}
                  </h3>
                  {expandedBlock === block.id && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.6', marginBottom: '0' }}>
                      {block.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginLeft: '16px', flexShrink: 0 }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--tx-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Weeks</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{block.weeks}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--tx-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Deloads</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{block.deloads}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--tx-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Sharpen</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{block.sharpen}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Principles Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Principle 1 */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              MECHANICAL TENSION DRIVES HYPERTROPHY
            </h2>
            <span style={{ padding: '4px 10px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ESTABLISHED
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
            Growth is chiefly a response to mechanical tension. Effort, load, and full range of motion produce more tension per set than short-ROM or light metabolite accumulation. Metabolic and mechanical damage pathways contribute under tension.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', margin: 0 }}>
            <strong>Schoenfeld BJ.</strong> The mechanisms of muscle hypertrophy and their application to resistance training. <em>J Strength Cond Res 2010;24(10):2857–2872.</em>
          </p>
        </div>

        {/* Principle 2 */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              A CUT, MUSCLE RETENTION LEANS ON INTENSITY, NOT VOLUME
            </h2>
            <span style={{ padding: '4px 10px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ESTABLISHED
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
            Under a caloric deficit, recovery is compromised and high-volume programs overtax the athlete's tolerance. Heavy submaximal loading protects the retention signal even when total volume is trimmed. Overload holds primary lifts at RPE 8 for 5 to 8 reps across 19 weeks, trimming accessory sets and trim accessory volume as the deficit deepens. Primaries are deliberately not taken to failure, never triples, never RPE 9: that is a strength peak, not a retention block.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', margin: 0 }}>
            <strong>Garthe I, Raastad T, Refsnes PE, Koivisto A, Sundgot-Borgen J.</strong> Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. <em>Int J Sport Nutr Exerc Metab 2011;21(2):97-104.</em>
          </p>
        </div>

        {/* Principle 3 */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              18-20 HARD SETS PER MUSCLE PER WEEK IS THE EFFECTIVE RANGE
            </h2>
            <span style={{ padding: '4px 10px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ESTABLISHED
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
            Submaximal high-volume meta shows a roughly linear return through about 10 to 20 hard sets per muscle per week for trained lifters. Overload targets the middle of the range in Block 1 and lands near the lower end by Block 4, matching the reduced recovery capacity of a deep cut.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', marginBottom: '8px' }}>
            <strong>Schoenfeld BJ, Ogborn D, Krieger JW.</strong> Dose–response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. <em>J Sports Sci 2017;35(11):1073–1082.</em>
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', margin: 0 }}>
            <strong>Schoenfeld BJ, Ogborn D, Krieger JW.</strong> Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. <em>Sports Med 2016;46(11):1689–1697.</em>
          </p>
        </div>

        {/* Principle 4 */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              TRAIN 8 TO 3 REPS AT RPE 8
            </h2>
            <span style={{ padding: '4px 10px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ESTABLISHED
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
            Sets taken to 3 reps shy of failure produce nearly identical hypertrophy at equated volume, and closer proximity to failure is required when total volume is cut. Overload holds primaries at RPE 8 (about 2 RIR at start of block; about 1 RIR end) to quality reps at 8 accumulate without draining CNS or joints, accessories run 8 to 10 RIR at the start, finishing up to 2 from failure without pushing to failure.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', margin: 0 }}>
            <strong>Hackett DA, Johnson NA, Halaki M, Chow CM.</strong> A novel scale to assess resistance-exercise effort. <em>J Sports Sci 2012;30(13):1405-1413.</em>
          </p>
        </div>

        {/* Principle 5 */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              FULL RANGE WITH A LOADED STRETCH
            </h2>
            <span style={{ padding: '4px 10px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ESTABLISHED
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
            Lengthened partials and full-ROM work at matched load hurt form short-ROM work at matched load. Overload biases exercise selection toward stretch-position variants: incline DB over flat; decline DB over flat; Romanian deadlift, overhead triceps, Bulgarian split squat, seated leg curl.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', marginBottom: '8px' }}>
            <strong>Pedrosa GF, Lima FV, Schoenfeld BJ, et al.</strong> Partial range of motion training elicits favorable improvements in muscular adaptations when carried out at long muscle lengths. <em>Eur J Sport Sci 2022;22(8):1250-1260.</em>
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', margin: 0 }}>
            <strong>Kassiano W, Nunes JP, Costa B, et al.</strong> Greater neural adaptations following high- vs. low-load resistance training. <em>Physiol Rep 2023;11(6):e15558.</em>
          </p>
        </div>

        {/* Principle 6 */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              PRIMARIES FOR HIGH STIMULUS-TO-FATIGUE, ACCESSORIES TO COVER ANGLES
            </h2>
            <span style={{ padding: '4px 10px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ESTABLISHED
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
            Compound free-weight lifts move the most load per unit of systemic fatigue and drive the biggest strength signal, which is what protects contractile tissue in a deficit. Isolation and machine work fills coverage gaps (long-head triceps overhead, long-head biceps stretched, seated hamstring) without adding much CNS cost.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', marginBottom: '8px' }}>
            <strong>Nunes JP, Grgic J, Cunha PM, et al.</strong> What influence does resistance exercise order have on muscular strength gains and muscle hypertrophy? <em>Eur J Sport Sci 2021;21(2):149-157.</em>
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', margin: 0 }}>
            <strong>Suchomeli TJ, Nimphius S, Stone MH.</strong> The importance of muscular strength in athletic performance. <em>Sports Med 2016;46(10):1419-1449.</em>
          </p>
        </div>

        {/* Principle 7 */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              CUT NUTRITION IS THE DEFICIT: TRAINING KEEPS MUSCLE
            </h2>
            <span style={{ padding: '4px 10px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ESTABLISHED
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
            The strongest natural-physique evidence shows that under a deficit, adequate protein (roughly 1.6 to 2.4 g/kg body weight per day) plus intense resistance training preserves lean mass and directs the deficit toward fat. Overload is the training piece; the nutrition is separate.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', marginBottom: '8px' }}>
            <strong>Helms ER, Aragon AA, Fitschen PJ.</strong> Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. <em>J Int Soc Sports Nutr 2014;11:20.</em>
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-muted)', lineHeight: '1.6', margin: 0 }}>
            <strong>Longland TM, Oikawa SY, Mitchell CJ, Devries MC, Phillips SM.</strong> Higher compared with lower dietary protein during an energy deficit combined with intense exercise promotes greater lean mass gain and fat mass loss. <em>Am J Clin Nutr 2016;103(3):738-746.</em>
          </p>
        </div>
      </div>
    </div>
  )
}
