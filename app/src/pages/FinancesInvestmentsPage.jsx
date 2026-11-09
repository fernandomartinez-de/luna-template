import InvestmentsTab from './finances/InvestmentsTab.jsx'

export default function FinancesInvestmentsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)' }}>Investments</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--tx-muted)' }}>Net worth, portfolio composition, and performance</p>
      </div>
      <InvestmentsTab />
    </div>
  )
}
