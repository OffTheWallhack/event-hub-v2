import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileText, Plus, TriangleAlert } from 'lucide-react'
import { Empty, ErrorText, PageHeader, Section, Stat } from '../components/ui'
import { supabase } from '../lib/supabase'
import { ExpenseForm } from '../components/ExpenseForm'
import { BottomBar } from '../components/BottomBar'
import {
  type Expense, type MonthPayout, DOC_COLOR, DOC_LABEL, EXPENSE_COLUMNS, monthRange, summarize, withTax,
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
    <div className="page">
      <PageHeader title={<span className="capitalize">{monthName(m)} <span className="muted font-semibold">{month.slice(0, 4)}</span></span>} sub="Financie mesiaca" />

      <BottomBar>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shift(month, -1))} className="btn btn-icon" aria-label="Predošlý mesiac"><ChevronLeft aria-hidden /></button>
          <button onClick={() => setMonth(todayLocal().slice(0, 7))} className="btn flex-1 capitalize" title="Tento mesiac">
            {monthName(m)} {month.slice(0, 4)}
          </button>
          <button onClick={() => setMonth(shift(month, 1))} className="btn btn-icon" aria-label="Ďalší mesiac"><ChevronRight aria-hidden /></button>
        </div>
      </BottomBar>

      {drive && !drive.connected && (
        <div className="notice text-sm">
          <TriangleAlert className="w-5 h-5 text-[var(--warn)] shrink-0" aria-hidden />
          <p>Google Drive nie je prepojený, doklady sa zatiaľ nedajú nahrať. <Link to="/nastavenia" className="link">Nastavenia →</Link></p>
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      <div className="card section grid grid-cols-3 gap-3">
        <Stat label="Vedľajšie náklady" value={<span className="text-lg sm:text-2xl">{eur(sum.exp)}</span>} sub={`${expenses.length} dokladov`} />
        <Stat label="Brigádnici + 15 %" value={<span className="text-lg sm:text-2xl">{eur(sum.pay)}</span>} sub={`základ ${eur(sum.payBase)}`} />
        <Stat label="Pošle Red Bull" value={<span className="text-lg sm:text-2xl text-[var(--color-signal)]">{eur(sum.total)}</span>} sub="spolu" />
      </div>

      <Section
        title="Výdavky"
        action={!form && <button onClick={() => setForm('new')} className="btn btn-sm btn-primary"><Plus aria-hidden />Výdavok</button>}
      >
        {form ? (
          <ExpenseForm expense={form === 'new' ? undefined : form} defaultDay={month === todayLocal().slice(0, 7) ? undefined : `${month}-01`} onDone={done} />
        ) : expenses.length === 0 ? (
          <Empty>Žiadne výdavky.</Empty>
        ) : (
          <ul className="list text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="row !items-start">
                <span className="muted w-12 shrink-0 num pt-px whitespace-nowrap">{fmtDay(e.date).replace(/ \d{4}$/, '')}</span>
                <button onClick={() => setForm(e)} className="flex-1 min-w-0 text-left">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {e.doc_type && <span className="dot" style={{ background: DOC_COLOR[e.doc_type] }} />}
                    <b className="shrink-0">{(e.doc_type && DOC_LABEL[e.doc_type]) ?? 'Doklad'}</b>
                    {e.description && <span className="truncate"> · {e.description}</span>}
                  </span>
                  <span className="block truncate text-xs muted mt-0.5">
                    {e.events?.title ?? 'bez eventu'}{e.paid_by ? ` · ${e.paid_by}` : ''}{e.control ? ` · ${e.control}` : ''}
                  </span>
                </button>
                {e.drive_file_url
                  ? <a href={e.drive_file_url} target="_blank" rel="noreferrer" className="link pt-px" title="Doklad v Drive"><FileText className="w-4 h-4" aria-hidden /></a>
                  : <span className="opacity-25 pt-px" title="Bez dokladu v Drive"><FileText className="w-4 h-4" aria-hidden /></span>}
                <span className="font-semibold num w-20 text-right">{eur(Number(e.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Brigádnici" sub="Výplatu zadáš na stránke eventu v časti Vodiči.">
        {payouts.length === 0 ? (
          <Empty>Žiadne výplaty.</Empty>
        ) : (
          <ul className="list text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="row">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{p.drivers?.name}</span>
                  {p.events && (
                    <Link to="/event/$id" params={{ id: p.events.id }} className="block text-xs link !font-medium truncate">
                      {fmtDay(p.events.start_date.slice(0, 10)).replace(/ \d{4}$/, '')} · {p.events.title}
                    </Link>
                  )}
                </span>
                <span className="text-right num">
                  <b>{eur(withTax(p))}</b>
                  <span className="block text-xs muted">{eur(Number(p.amount))} + {Math.round(Number(p.tax_rate) * 100)} %</span>
                </span>
                <button onClick={() => togglePaid(p)} className={'badge ' + (p.paid ? 'badge-ok' : 'badge-danger') + ' !h-8 !px-2.5 shrink-0'} title="Prepnúť vyplatené / nevyplatené">
                  {p.paid && <Check className="w-3.5 h-3.5" aria-hidden />}{p.paid ? 'Vyplatené' : 'Nevyplatené'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
