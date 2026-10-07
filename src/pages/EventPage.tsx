import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { MovementForm } from '../components/MovementForm'
import { EventGear } from '../components/EventGear'
import { EventDrivers } from '../components/EventDrivers'
import { BriefShare } from '../components/BriefShare'
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
  useEffect(() => { load() }, [id, isAdmin])

  async function openCartons() {
    const { data } = await supabase
      .from('flavors')
      .select('id, name, label, color_bg, color_text, color_border, sort_order, active')
      .eq('active', true)
      .order('sort_order')
    setAddCartons((data ?? []) as Flavor[])
  }

  if (error) return <p className="text-[var(--color-signal)]">{error}</p>
  if (!ev || !d) return <p className="muted">Načítavam…</p>

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

  return (
    <section className="flex flex-col gap-4 min-w-0">
      <Link to="/" search={{ m: startDay(ev).slice(0, 7) }} className="text-sm muted">‹ Kalendár</Link>

      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: TYPE_COLOR[ev.event_type], color: TYPE_TEXT[ev.event_type] }}>
          {TYPE_LABEL[ev.event_type]}
        </span>
        <span className={'px-2 py-0.5 rounded text-xs font-semibold border line ' + (ev.status === 'cancelled' ? 'text-[var(--color-signal)]' : '')}>
          {STATUS_LABEL[ev.status]}
        </span>
        {ev.departments.map((dp) => (
          <span key={dp} className="px-2 py-0.5 rounded text-xs border line muted">{DEPT_LABEL[dp]}</span>
        ))}
        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)} className="ml-auto h-9 px-3 rounded-lg border line text-sm font-medium">Upraviť</button>
        )}
      </div>

      {/* Basecamp = zdroj pravdy, mení ho len sync */}
      <div className="card p-4 border-l-4" style={{ borderLeftColor: TYPE_COLOR[ev.event_type] }}>
        <p className="text-[11px] uppercase tracking-wider font-semibold muted">Z Basecampu · mení sa len synchronizáciou</p>
        <h1 className={'display text-3xl font-bold leading-tight mt-1 ' + (ev.status === 'cancelled' ? 'line-through opacity-60' : '')}>{ev.title}</h1>
        <p className="mt-1 font-medium">
          {fmtRange(ev)} <span className="muted">· {durationDays(ev)} {dayWord(durationDays(ev))}</span>
        </p>
        {ev.deleted_from_basecamp && (
          <p className="mt-2 text-sm text-[var(--color-signal)] font-semibold">Event zmizol z Basecampu.</p>
        )}
        {ev.basecamp_notes && <p className="mt-3 text-sm whitespace-pre-wrap break-words">{linkify(ev.basecamp_notes)}</p>}
        {ev.basecamp_url && (
          <a href={ev.basecamp_url} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-semibold text-[var(--color-sky)]">
            Otvoriť v Basecampe ↗
          </a>
        )}
      </div>

      {isAdmin && (
        <Card
          title="Náklady"
          right={
            <span className="flex items-center gap-2">
              <span className="display text-2xl font-bold">{eur(expSum + paySum)}</span>
              {!expenseForm && <button onClick={() => setExpenseForm('new')} className="h-9 px-3 rounded-lg border line text-sm font-medium">+ Účet</button>}
            </span>
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
            <p className="muted text-sm">{ev.no_expenses ? 'Bez nákladov.' : 'Zatiaľ žiadne účty.'}</p>
          ) : (
            <ul className="divide-y line text-sm">
              {d.expenses.map((e) => (
                <li key={e.id} className="py-2 flex gap-2 items-baseline">
                  <span className="muted w-14 shrink-0">{fmtDay(e.date).replace(/ \d{4}$/, '')}</span>
                  <button onClick={() => setExpenseForm(e)} className="flex-1 min-w-0 truncate text-left">
                    {(e.doc_type && DOC_LABEL[e.doc_type]) ?? 'Doklad'}{e.description ? ` · ${e.description}` : ''}
                  </button>
                  {e.drive_file_url && <a href={e.drive_file_url} target="_blank" rel="noreferrer" className="text-[var(--color-sky)]" title="Doklad">📄</a>}
                  <span className="font-semibold tabular-nums">{eur(Number(e.amount))}</span>
                </li>
              ))}
              {d.payouts.map((p) => (
                <li key={p.id} className="py-2 flex gap-2 items-baseline">
                  <span className="muted w-14 shrink-0">Výplata</span>
                  <span className="flex-1 min-w-0 truncate">
                    {p.drivers?.name ?? '?'} · {eur(Number(p.amount))} + {Math.round(Number(p.tax_rate) * 100)} %
                    {p.paid ? <span className="muted"> · vyplatené</span> : <span className="text-[var(--color-signal)]"> · nevyplatené</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{eur(payWithTax(p))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editing ? (
        <EditForm ev={ev} onDone={(saved) => { setEditing(false); if (saved) load() }} />
      ) : (
        <Card title="Logistika">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
            <Row label="Príchod">{ev.planned_arrival?.slice(0, 5)}</Row>
            <Row label="Lokalita">
              {ev.location}
              {ev.location_url && (
                <a href={ev.location_url} target="_blank" rel="noreferrer" className="ml-2 text-[var(--color-sky)] font-semibold">Mapa ↗</a>
              )}
            </Row>
            <Row label="Kontakt">{ev.contact && <span className="whitespace-pre-wrap">{linkify(ev.contact)}</span>}</Row>
            <Row label="Diváci">{ev.spectators}</Row>
            <Row label="Popis">{ev.description && <span className="whitespace-pre-wrap">{ev.description}</span>}</Row>
          </dl>
        </Card>
      )}

      <EventDrivers eventId={ev.id} isAdmin={isAdmin} onChanged={load} />
      <EventGear eventId={ev.id} isAdmin={isAdmin} />

      <Card
        title="Kartóny"
        right={isAdmin && !addCartons && (
          <button onClick={openCartons} className="h-9 px-3 rounded-lg border line text-sm font-medium">+ Kartóny</button>
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
          <p className="muted text-sm">Žiadne.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {cartons.map((c) => (
              <li key={c.label} className="px-2 py-1 rounded-lg border line">
                <span className="font-bold">{c.n}×</span> {c.label}
              </li>
            ))}
          </ul>
        )}
      </Card>


      {isAdmin && <BriefShare ev={ev} />}

      {(ev.rating || ev.report) && (
        <Card title="Report">
          {ev.rating && <p className="text-lg">{'★'.repeat(ev.rating)}<span className="muted">{'★'.repeat(5 - ev.rating)}</span></p>}
          {ev.report && <p className="text-sm whitespace-pre-wrap mt-1">{ev.report}</p>}
        </Card>
      )}
    </section>
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

  const input = 'w-full h-11 px-3 rounded-lg border line bg-transparent'
  return (
    <Card title="Upraviť event">
      <div className="grid gap-4">
        <Choice label="Stav" options={STATUSES} value={[f.status]} render={(s) => STATUS_LABEL[s]} onPick={(s) => set('status', s)} />
        <Choice label="Typ" options={TYPES} value={[f.event_type]} render={(t) => TYPE_LABEL[t]} onPick={(t) => set('event_type', t)} />
        <Choice
          label="Oddelenie (aj viac)"
          options={DEPTS}
          value={f.departments}
          render={(dp) => DEPT_LABEL[dp]}
          onPick={(dp) => set('departments', f.departments.includes(dp) ? f.departments.filter((x) => x !== dp) : [...f.departments, dp])}
        />
        <Field label="Čas príchodu"><input type="time" className={input} value={f.planned_arrival} onChange={(e) => set('planned_arrival', e.target.value)} /></Field>
        <Field label="Lokalita"><input className={input} value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
        <Field label="Odkaz na mapu"><input type="url" inputMode="url" className={input} value={f.location_url} onChange={(e) => set('location_url', e.target.value)} placeholder="https://maps.google.com/…" /></Field>
        <Field label="Kontakt"><textarea rows={2} className={input + ' h-auto py-2'} value={f.contact} onChange={(e) => set('contact', e.target.value)} /></Field>
        <Field label="Diváci"><input type="number" inputMode="numeric" min={0} className={input} value={f.spectators} onChange={(e) => set('spectators', e.target.value)} /></Field>
        <Field label="Popis práce"><textarea rows={3} className={input + ' h-auto py-2'} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60">
            {saving ? 'Ukladám…' : 'Uložiť'}
          </button>
          <button onClick={() => onDone(false)} className="h-11 px-4 rounded-lg border line">Zrušiť</button>
        </div>
      </div>
    </Card>
  )
}

function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="display text-xl font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === '' || children === false
  return (
    <>
      <dt className="muted">{label}</dt>
      <dd className="min-w-0 break-words">{empty ? <span className="muted">–</span> : children}</dd>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="muted">{label}</span>
      {children}
    </label>
  )
}

function Choice<T extends string>({ label, options, value, render, onPick }: {
  label: string; options: T[]; value: T[]; render: (v: T) => string; onPick: (v: T) => void
}) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="muted">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            className={'h-10 px-3 rounded-lg border line ' + (value.includes(o) ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')}
          >
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

function dayWord(n: number) {
  return n === 1 ? 'deň' : n >= 2 && n <= 4 ? 'dni' : 'dní'
}

// Z textu urobí klikateľné odkazy.
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="text-[var(--color-sky)] break-all">{part}</a>
    ) : (
      part
    ),
  )
}
