import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ExternalLink, FileText, MapPin, Pencil, Plus } from 'lucide-react'
import { Badge, Chips, Empty, ErrorText, Field, KV, Section, Seg, dayWord, linkify } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { MovementForm } from '../components/MovementForm'
import { EventGear } from '../components/EventGear'
import { EventDrivers } from '../components/EventDrivers'
import { BriefShare } from '../components/BriefShare'
import { EventReport } from '../components/EventReport'
import { EventNavBar } from '../components/EventNavBar'
import { ExpenseForm } from '../components/ExpenseForm'
import { type Expense, DOC_LABEL, EXPENSE_COLUMNS } from '../lib/finance'
import type { Flavor } from '../lib/cartons'
import {
  type Department, type EventRow, type EventStatus, type EventType,
  DEPT_LABEL, STATUS_LABEL, TYPE_COLOR, TYPE_LABEL, TYPE_TEXT,
  durationDays, eur, fmtDay, fmtRange, startDay,
} from '../lib/events'

type Carton = { cartons: number; flavors: { name: string; label: string | null; sort_order: number } | null }
type Payout = { id: string; amount: number; tax_rate: number; paid: boolean; drivers: { name: string } | null }

type Details = { cartons: Carton[]; expenses: Expense[]; payouts: Payout[] }

const STATUSES: EventStatus[] = ['planned', 'done', 'cancelled']
const TYPES: EventType[] = ['event_car', 'support', 'adhoc', 'servis']
const DEPTS: Department[] = ['ec', 'culture', 'sport', 'onpremise']

export function EventPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const { isAdmin } = useAuth()
  const [ev, setEv] = useState<EventRow | null>(null)
  const [d, setD] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [addCartons, setAddCartons] = useState<Flavor[] | null>(null)
  const [expenseForm, setExpenseForm] = useState<Expense | 'new' | null>(null)

  async function load() {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
    if (error) return setError(error.message)
    if (!data) return setError('Event sa nenašiel.')
    setEv(data as EventRow)

    const [ct, ex, po] = await Promise.all([
      supabase.from('carton_movements').select('cartons, flavors(name, label, sort_order)').eq('event_id', id).eq('type', 'event'),
      isAdmin
        ? supabase.from('expenses').select(EXPENSE_COLUMNS).eq('event_id', id).order('date')
        : Promise.resolve({ data: [] }),
      isAdmin
        ? supabase.from('driver_payouts').select('id, amount, tax_rate, paid, drivers(name)').eq('event_id', id)
        : Promise.resolve({ data: [] }),
    ])
    setD({
      cartons: (ct.data ?? []) as unknown as Carton[],
      expenses: (ex.data ?? []) as unknown as Expense[],
      payouts: (po.data ?? []) as unknown as Payout[],
    })
  }
  useEffect(() => {
    setEditing(false); setAddCartons(null); setExpenseForm(null); setD(null)
    load()
  }, [id, isAdmin])

  async function openCartons() {
    const { data } = await supabase
      .from('flavors')
      .select('id, name, label, color_bg, color_text, color_border, sort_order, active')
      .eq('active', true)
      .order('sort_order')
    setAddCartons((data ?? []) as Flavor[])
  }

  if (error) return <p className="err">{error}</p>
  if (!ev || !d) {
    return (
      <div className="page">
        {ev && <EventNavBar ev={ev} />}
        <p className="muted">Načítavam…</p>
      </div>
    )
  }

  const expSum = d.expenses.reduce((s, e) => s + Number(e.amount), 0)
  const payWithTax = (p: Payout) => Number(p.amount) * (1 + Number(p.tax_rate))
  const paySum = d.payouts.reduce((s, p) => s + payWithTax(p), 0)

  // kartóny po príchutiach (pohyby typu event sú záporné)
  const cartonMap = new Map<string, { label: string; n: number; order: number }>()
  for (const c of d.cartons) {
    const key = c.flavors?.name ?? '?'
    const cur = cartonMap.get(key) ?? { label: c.flavors?.label || key, n: 0, order: c.flavors?.sort_order ?? 0 }
    cur.n += -c.cartons
    cartonMap.set(key, cur)
  }
  const cartons = [...cartonMap.values()].filter((c) => c.n !== 0).sort((a, b) => a.order - b.order)
  const statusTone = ev.status === 'done' ? 'ok' : ev.status === 'cancelled' ? 'danger' : 'neutral'

  return (
    <div className="page">
      <EventNavBar ev={ev} />
      <div>
        <Link to="/" search={{ m: startDay(ev).slice(0, 7) }} className="btn btn-sm btn-quiet -ml-3"><ChevronLeft aria-hidden />Kalendár</Link>
      </div>

      {/* Basecamp = zdroj pravdy, mení ho len sync */}
      <header className="card section">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge" style={{ background: TYPE_COLOR[ev.event_type], color: TYPE_TEXT[ev.event_type] }}>{TYPE_LABEL[ev.event_type]}</span>
          <Badge tone={statusTone}>{STATUS_LABEL[ev.status]}</Badge>
          {ev.departments.map((dp) => <Badge key={dp}>{DEPT_LABEL[dp]}</Badge>)}
        </div>
        <h1 className={'page-title !text-[1.75rem] mt-3 ' + (ev.status === 'cancelled' ? 'line-through opacity-60' : '')}>{ev.title}</h1>
        <p className="mt-2 flex items-start gap-2 font-medium">
          <CalendarDays className="w-4 h-4 muted shrink-0 mt-[0.2em]" aria-hidden />
          <span>{fmtRange(ev)} <span className="muted font-normal">· {durationDays(ev)} {dayWord(durationDays(ev))}</span></span>
        </p>
        {ev.deleted_from_basecamp && <p className="err font-semibold mt-2">Event zmizol z Basecampu.</p>}
        {(ev.basecamp_notes || ev.basecamp_url) && (
          <div className="mt-4 rounded-[var(--ctl-r)] bg-[var(--fill)] p-3">
            <p className="eyebrow">Z Basecampu · mení sa len synchronizáciou</p>
            {ev.basecamp_notes && <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{linkify(ev.basecamp_notes)}</p>}
            {ev.basecamp_url && (
              <a href={ev.basecamp_url} target="_blank" rel="noreferrer" className="link text-sm inline-flex items-center gap-1 mt-2">
                Otvoriť v Basecampe<ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
            )}
          </div>
        )}
      </header>

      {editing ? (
        <EditForm ev={ev} onDone={(saved) => { setEditing(false); if (saved) load() }} />
      ) : (
        <Section title="Logistika" action={isAdmin && <button onClick={() => setEditing(true)} className="btn btn-sm"><Pencil aria-hidden />Upraviť</button>}>
          <dl className="kv">
            <KV label="Príchod">{ev.planned_arrival?.slice(0, 5)}</KV>
            <KV label="Lokalita">
              {ev.location}
              {ev.location_url && (
                <a href={ev.location_url} target="_blank" rel="noreferrer" className="link ml-2 inline-flex items-center gap-0.5">
                  <MapPin className="w-3.5 h-3.5" aria-hidden />Mapa
                </a>
              )}
            </KV>
            <KV label="Kontakt">{ev.contact && <span className="whitespace-pre-wrap">{linkify(ev.contact)}</span>}</KV>
            <KV label="Diváci">{ev.spectators}</KV>
            <KV label="Popis">{ev.description && <span className="whitespace-pre-wrap">{ev.description}</span>}</KV>
          </dl>
        </Section>
      )}

      <EventDrivers eventId={ev.id} isAdmin={isAdmin} onChanged={load} />
      <EventGear eventId={ev.id} isAdmin={isAdmin} />

      <Section
        title="Kartóny"
        action={isAdmin && !addCartons && (
          <button onClick={openCartons} className="btn btn-sm"><Plus aria-hidden />Pridať</button>
        )}
      >
        {addCartons ? (
          <MovementForm
            flavors={addCartons}
            fixedEventId={ev.id}
            fixedEventDay={startDay(ev)}
            onDone={(saved) => { setAddCartons(null); if (saved) load() }}
          />
        ) : cartons.length === 0 ? (
          <Empty>Žiadne.</Empty>
        ) : (
          <ul className="chips">
            {cartons.map((c) => (
              <li key={c.label} className="chip pointer-events-none">
                <b className="num">{c.n}×</b> {c.label}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isAdmin && (
        <Section
          title="Náklady"
          action={
            <>
              <span className="stat-value !text-xl">{eur(expSum + paySum)}</span>
              {!expenseForm && <button onClick={() => setExpenseForm('new')} className="btn btn-sm"><Plus aria-hidden />Účet</button>}
            </>
          }
        >
          {expenseForm ? (
            <ExpenseForm
              expense={expenseForm === 'new' ? undefined : expenseForm}
              fixedEventId={ev.id}
              defaultDay={startDay(ev)}
              onDone={(saved) => { setExpenseForm(null); if (saved) load() }}
            />
          ) : d.expenses.length === 0 && d.payouts.length === 0 ? (
            <Empty>{ev.no_expenses ? 'Bez nákladov.' : 'Zatiaľ žiadne účty.'}</Empty>
          ) : (
            <ul className="list text-sm">
              {d.expenses.map((e) => (
                <li key={e.id} className="row">
                  <span className="muted w-12 shrink-0 num whitespace-nowrap">{fmtDay(e.date).replace(/ \d{4}$/, '')}</span>
                  <button onClick={() => setExpenseForm(e)} className="flex-1 min-w-0 truncate text-left">
                    {(e.doc_type && DOC_LABEL[e.doc_type]) ?? 'Doklad'}{e.description ? <span className="muted"> · {e.description}</span> : ''}
                  </button>
                  {e.drive_file_url && <a href={e.drive_file_url} target="_blank" rel="noreferrer" className="link" title="Doklad v Drive"><FileText className="w-4 h-4" aria-hidden /></a>}
                  <span className="font-semibold num">{eur(Number(e.amount))}</span>
                </li>
              ))}
              {d.payouts.map((p) => (
                <li key={p.id} className="row">
                  <span className="muted w-12 shrink-0">Výplata</span>
                  <span className="flex-1 min-w-0 truncate">
                    {p.drivers?.name ?? '?'} <span className="muted">· {eur(Number(p.amount))} + {Math.round(Number(p.tax_rate) * 100)} %</span>
                  </span>
                  <Badge tone={p.paid ? 'ok' : 'danger'}>{p.paid ? 'vyplatené' : 'nevyplatené'}</Badge>
                  <span className="font-semibold num">{eur(payWithTax(p))}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {isAdmin && <BriefShare ev={ev} />}

      {isAdmin && <EventReport key={ev.id + ev.status} ev={ev} cartons={cartons.map((c) => ({ label: c.label, n: c.n }))} onChanged={load} />}

      {!isAdmin && (ev.rating || ev.report) && (
        <Section title="Report">
          {ev.rating && <p className="text-lg text-[var(--color-amber)]">{'★'.repeat(ev.rating)}<span className="opacity-25">{'★'.repeat(5 - ev.rating)}</span></p>}
          {ev.report && <p className="text-sm whitespace-pre-wrap mt-1">{ev.report}</p>}
        </Section>
      )}
    </div>
  )
}

function EditForm({ ev, onDone }: { ev: EventRow; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({
    status: ev.status,
    event_type: ev.event_type,
    departments: ev.departments,
    location: ev.location ?? '',
    location_url: ev.location_url ?? '',
    planned_arrival: ev.planned_arrival?.slice(0, 5) ?? '',
    contact: ev.contact ?? '',
    spectators: ev.spectators?.toString() ?? '',
    description: ev.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const nn = (s: string) => (s.trim() === '' ? null : s.trim())

  async function save() {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('events')
      .update({
        status: f.status,
        event_type: f.event_type,
        departments: f.departments,
        location: nn(f.location),
        location_url: nn(f.location_url),
        planned_arrival: nn(f.planned_arrival),
        contact: nn(f.contact),
        spectators: f.spectators.trim() === '' ? null : Number(f.spectators),
        description: nn(f.description),
      })
      .eq('id', ev.id)
    setSaving(false)
    if (error) setError(error.message)
    else onDone(true)
  }

  return (
    <Section title="Upraviť event">
      <div className="form">
        <div className="field"><span className="field-label">Stav</span>
          <Seg options={STATUSES.map((s) => [s, STATUS_LABEL[s]] as const)} value={f.status} onChange={(s) => set('status', s)} /></div>
        <div className="field"><span className="field-label">Typ</span>
          <Chips options={TYPES.map((t) => [t, TYPE_LABEL[t]] as const)} isOn={(t) => f.event_type === t} onPick={(t) => set('event_type', t)} /></div>
        <div className="field"><span className="field-label">Oddelenie (aj viac)</span>
          <Chips
            options={DEPTS.map((dp) => [dp, DEPT_LABEL[dp]] as const)}
            isOn={(dp) => f.departments.includes(dp)}
            onPick={(dp) => set('departments', f.departments.includes(dp) ? f.departments.filter((x) => x !== dp) : [...f.departments, dp])}
          /></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Čas príchodu"><input type="time" className="input" value={f.planned_arrival} onChange={(e) => set('planned_arrival', e.target.value)} /></Field>
          <Field label="Diváci"><input type="number" inputMode="numeric" min={0} className="input" value={f.spectators} onChange={(e) => set('spectators', e.target.value)} /></Field>
        </div>
        <Field label="Lokalita"><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
        <Field label="Odkaz na mapu"><input type="url" inputMode="url" className="input" value={f.location_url} onChange={(e) => set('location_url', e.target.value)} placeholder="https://maps.google.com/…" /></Field>
        <Field label="Kontakt"><textarea rows={2} className="input" value={f.contact} onChange={(e) => set('contact', e.target.value)} /></Field>
        <Field label="Popis práce"><textarea rows={3} className="input" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="form-actions">
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Ukladám…' : 'Uložiť'}</button>
          <button onClick={() => onDone(false)} className="btn btn-quiet">Zrušiť</button>
        </div>
      </div>
    </Section>
  )
}
