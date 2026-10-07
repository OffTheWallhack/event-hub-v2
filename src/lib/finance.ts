// Financie: výdavky a výplaty vodičov (len admin, RLS).

export type DocType = 'blok' | 'ucet' | 'faktura' | 'taxi' | 'brigadnik' | 'screenshot' | 'ziadny'

export type Expense = {
  id: string
  date: string
  doc_type: DocType | null
  amount: number
  description: string | null
  event_id: string | null
  control: string | null
  drive_file_url: string | null
  drive_file_name: string | null
  paid_by: string | null
  note: string | null
  events?: { id: string; title: string } | null
}

export type Payout = {
  id: string
  event_id: string
  driver_id: string
  amount: number
  tax_rate: number
  paid: boolean
  paid_at: string | null
  note: string | null
}

export const DOC_LABEL: Record<DocType, string> = {
  blok: 'Bloček',
  ucet: 'Účet',
  faktura: 'Faktúra',
  taxi: 'Taxi',
  brigadnik: 'Brigádnik',
  screenshot: 'Screenshot',
  ziadny: 'Žiadny doklad',
}
// brigádnik sa pridáva cez výplaty, nie ako výdavok
export const DOC_TYPES: DocType[] = ['blok', 'ucet', 'faktura', 'taxi', 'screenshot', 'ziadny']

export const TAX_RATE = 0.15
export const withTax = (p: Pick<Payout, 'amount' | 'tax_rate'>) => Math.round(Number(p.amount) * (1 + Number(p.tax_rate)) * 100) / 100

export const EXPENSE_COLUMNS = 'id, date, doc_type, amount, description, event_id, control, drive_file_url, drive_file_name, paid_by, note'

export type MonthPayout = Payout & {
  drivers: { name: string } | null
  events: { id: string; title: string; start_date: string } | null
}

// Prvý deň mesiaca a prvý deň nasledujúceho (YYYY-MM-DD).
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return [`${month}-01`, `${next}-01`]
}

export function summarize(expenses: Pick<Expense, 'amount'>[], payouts: Pick<Payout, 'amount' | 'tax_rate'>[]) {
  const exp = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const payBase = payouts.reduce((s, p) => s + Number(p.amount), 0)
  const pay = payouts.reduce((s, p) => s + withTax(p), 0)
  return { exp, payBase, pay, total: Math.round((exp + pay) * 100) / 100 }
}

export const DOC_COLOR: Record<DocType, string> = {
  blok: '#2f6fdd',
  ucet: '#7c3aed',
  faktura: '#d7263d',
  taxi: '#f29e1f',
  brigadnik: '#2e8b57',
  screenshot: '#0d9488',
  ziadny: '#8f99aa',
}
