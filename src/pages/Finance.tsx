import { Link } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { ExpenseForm } from '../components/ExpenseForm'
import { BottomBar } from '../components/BottomBar'
import {
  type Expense, type MonthPayout, DOC_LABEL, EXPENSE_COLUMNS, monthRange, summarize, withTax,
} from '../lib/finance'
import { eur, fmtDay, monthName, todayLocal } from '../lib/events'

function shift(month: string, by: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function Finance() {
  const [month, setMonth] = useState(todayLocal().slice(0, 7))
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payouts, setPayouts] = useState<MonthPayout[]>([])
  const [form, setForm] = useState<Expense | 'new' | null>(null)
  const [drive, setDrive] = useState<{ connected: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const [from, to] = monthRange(month)
    Promise.all([
      supabase.from('expenses').select(`${EXPENSE_COLUMNS}, events(id, title)`).gte('date', from).lt('date', to).order('date', { ascending: false }),
      // výplaty patria do mesiaca podľa začiatku eventu
      supabase
        .from('driver_payouts')
        .select('id, event_id, driver_id, amount, tax_rate, paid, paid_at, note, drivers(name), events!inner(id, title, start_date)')
        .gte('events.start_date', from)
        .lt('events.start_date', to),
    ]).then(([e, p]) => {
      const err = e.error ?? p.error
      if (err) return setError(err.message)
      setExpenses(e.data as unknown as Expense[])
      setPayouts((p.data as unknown as MonthPayout[]).sort((a, b) => (a.events?.start_date ?? '').localeCompare(b.events?.start_date ?? '')))
    })
  }, [month, reload])

  useEffect(() => {
    supabase.functions.invoke('drive', { body: { action: 'status' } }).then(({ data }) => setDrive(data ?? null))
  }, [])

  async function togglePaid(p: MonthPayout) {
    const paid = !p.paid
    const { error } = await supabase.from('driver_payouts').update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', p.id)
    if (error) setError(error.message)
    else setReload((r) => r + 1)
  }

  const sum = summarize(expenses, payouts)
  const m = Number(month.slice(5, 7)) - 1
  const done = (saved: boolean) => { setForm(null); if (saved) setReload((r) => r + 1) }

  return (
    <section className="flex flex-col gap-4 min-w-0">
      <h1 className="display text-4xl font-bold capitalize whitespace-nowrap">
        {monthName(m)} <span className="muted font-medium">{month.slice(0, 4)}</span>
      </h1>

      <BottomBar>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shift(month, -1))} className="h-11 w-14 rounded-lg border line text-xl" aria-label="Predošlý mesiac">‹</button>
          <button onClick={() => setMonth(todayLocal().slice(0, 7))} className="flex-1 h-11 rounded-lg border line font-semibold capitalize">
            {monthName(m)} {month.slice(0, 4)}
          </button>
          <button onClick={() => setMonth(shift(month, 1))} className="h-11 w-14 rounded-lg border line text-xl" aria-label="Ďalší mesiac">›</button>
        </div>
      </BottomBar>

      {drive && !drive.connected && (
        <p className="card p-3 text-sm">
          Google Drive nie je prepojený, doklady sa zatiaľ nedajú nahrať. <Link to="/nastavenia" className="text-[var(--color-sky)] font-semibold">Nastavenia →</Link>
        </p>
      )}
      {error && <p className="text-[var(--color-signal)]">{error}</p>}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Vedľajšie náklady" value={eur(sum.exp)} sub={`${expenses.length} dokladov`} />
        <Stat label="Brigádnici + 15 %" value={eur(sum.pay)} sub={`základ ${eur(sum.payBase)}`} />
        <Stat label="Pošle Red Bull" value={eur(sum.total)} strong />
      </div>

      <Card
        title="Výdavky"
        right={!form && <button onClick={() => setForm('new')} className="h-9 px-3 rounded-lg font-semibold text-white bg-[var(--color-signal)] text-sm">+ Výdavok</button>}
      >
        {form ? (
          <ExpenseForm expense={form === 'new' ? undefined : form} defaultDay={month === todayLocal().slice(0, 7) ? undefined : `${month}-01`} onDone={done} />
        ) : expenses.length === 0 ? (
          <p className="muted text-sm">Žiadne výdavky.</p>
        ) : (
          <ul className="divide-y line text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="py-2 flex gap-2 items-start">
                <span className="muted w-12 shrink-0">{fmtDay(e.date).replace(/ \d{4}$/, '')}</span>
                <button onClick={() => setForm(e)} className="flex-1 min-w-0 text-left">
                  <span className="block truncate">{(e.doc_type && DOC_LABEL[e.doc_type]) ?? 'Doklad'}{e.description ? ` · ${e.description}` : ''}</span>
                  <span className="block truncate text-xs muted">
                    {e.events?.title ?? 'bez eventu'}{e.paid_by ? ` · ${e.paid_by}` : ''}{e.control ? ` · ${e.control}` : ''}
                  </span>
                </button>
                {e.drive_file_url
                  ? <a href={e.drive_file_url} target="_blank" rel="noreferrer" title="Doklad v Drive">📄</a>
                  : <span className="opacity-30" title="Bez dokladu v Drive">📄</span>}
                <span className="font-semibold tabular-nums w-20 text-right">{eur(Number(e.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Brigádnici">
        {payouts.length === 0 ? (
          <p className="muted text-sm">Žiadne výplaty.</p>
        ) : (
          <ul className="divide-y line text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="py-2 flex gap-2 items-center">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{p.drivers?.name}</span>
                  {p.events && (
                    <Link to="/event/$id" params={{ id: p.events.id }} className="block text-xs text-[var(--color-sky)] truncate">
                      {fmtDay(p.events.start_date.slice(0, 10)).replace(/ \d{4}$/, '')} · {p.events.title}
                    </Link>
                  )}
                </span>
                <span className="text-right tabular-nums">
                  <b>{eur(withTax(p))}</b>
                  <span className="block text-xs muted">{eur(Number(p.amount))} + {Math.round(Number(p.tax_rate) * 100)} %</span>
                </span>
                <button
                  onClick={() => togglePaid(p)}
                  className={'h-8 px-2 rounded-lg text-xs font-semibold border shrink-0 ' + (p.paid ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400' : 'border-[var(--color-signal)] text-[var(--color-signal)]')}
                >
                  {p.paid ? 'Vyplatené' : 'Nevyplatené'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs muted mt-2">Výplatu zadáš na stránke eventu v časti Vodiči.</p>
      </Card>
    </section>
  )
}

function Stat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={'card p-3 ' + (strong ? 'border-[var(--color-signal)] border-2' : '')}>
      <p className="text-[11px] muted leading-tight">{label}</p>
      <p className="display text-xl sm:text-2xl font-bold leading-tight mt-1">{value}</p>
      {sub && <p className="text-[11px] muted">{sub}</p>}
    </div>
  )
}

function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="card p-4 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="display text-xl font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}
