import ExpensesTab from './finances/ExpensesTab.jsx'

export default function FinancesExpensesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)' }}>Expenses</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--tx-muted)' }}>Monthly spending, fixed costs, and category trends</p>
      </div>
      <ExpensesTab />
    </div>
  )
}
