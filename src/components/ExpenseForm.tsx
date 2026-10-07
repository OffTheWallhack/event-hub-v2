import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { type DocType, type Expense, DOC_LABEL, DOC_TYPES } from '../lib/finance'
import { type DriveFile, shrinkImage, uploadReceipt } from '../lib/receipt'
import { ReceiptViewer } from './ReceiptViewer'
import { BusyOverlay } from './BusyOverlay'
import { addDays, fmtRange, todayLocal } from '../lib/events'

type EventOpt = { id: string; title: string; start_date: string; end_date: string | null }

/**
 * Nový alebo upravený výdavok. Doklad (fotka/PDF) sa nahrá do Google Drive
 * (Event Hub / Účty / YYYY-MM) a do výdavku sa uloží odkaz.
 */
export function ExpenseForm({ expense, fixedEventId, defaultDay, onDone }: {
  expense?: Expense
  fixedEventId?: string
  defaultDay?: string
  onDone: (saved: boolean) => void
}) {
  const [day, setDay] = useState(expense?.date ?? defaultDay ?? todayLocal())
  const [docType, setDocType] = useState<DocType>(expense?.doc_type ?? 'blok')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [desc, setDesc] = useState(expense?.description ?? '')
  const [eventId, setEventId] = useState(expense?.event_id ?? fixedEventId ?? '')
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? 'Robo')
  const [control, setControl] = useState(expense?.control ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [events, setEvents] = useState<EventOpt[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  // už nahraný doklad: pri chybe ukladania do databázy sa nenahráva druhýkrát
  const uploaded = useRef<{ key: string; drive: DriveFile } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // eventy okolo dátumu dokladu, najnovšie hore
  useEffect(() => {
    if (fixedEventId) return
    supabase
      .from('events')
      .select('id, title, start_date, end_date')
      .neq('status', 'cancelled')
      .gte('start_date', addDays(day, -45))
      .lte('start_date', addDays(day, 14))
      .order('start_date', { ascending: false })
      .then(async ({ data }) => {
        let list = (data ?? []) as EventOpt[]
        // pri úprave starého výdavku nech je jeho event vždy v zozname
        if (eventId && !list.some((e) => e.id === eventId)) {
          const { data: one } = await supabase.from('events').select('id, title, start_date, end_date').eq('id', eventId).maybeSingle()
          if (one) list = [one as EventOpt, ...list]
        }
        setEvents(list)
      })
  }, [day, fixedEventId])

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  async function pick(f: File | null) {
    setError(null)
    uploaded.current = null
    if (!f) return setFile(null)
    setSaving('Pripravujem fotku…')
    setFile(await shrinkImage(f))
    setSaving(null)
  }

  async function save() {
    setError(null)
    const sum = Number(amount.replace(',', '.'))
    if (!Number.isFinite(sum) || sum <= 0) return setError('Zadaj sumu.')
    let drive: { drive_file_url: string; drive_file_name: string } | null = null
    if (file) {
      const key = `${file.name}|${file.size}|${day}|${sum}|${desc}`
      let up = uploaded.current?.key === key ? uploaded.current.drive : null
      if (!up) {
        setSaving('Nahrávam doklad do Drive')
        setProgress(0)
        try {
          up = await uploadReceipt(file, { date: day, amount: sum, shop: desc }, setProgress)
          uploaded.current = { key, drive: up }
        } catch (e) {
          setSaving(null)
          setProgress(null)
          return setError((e as Error).message)
        }
      }
      drive = { drive_file_url: up.url, drive_file_name: up.name }
    }
    setProgress(null)
    setSaving('Ukladám výdavok')
    const row = {
      date: day,
      doc_type: docType,
      amount: sum,
      description: desc.trim() || null,
      event_id: eventId || null,
      paid_by: paidBy.trim() || null,
      control: control.trim() || null,
      ...(drive ?? {}),
    }
    const { error } = expense
      ? await supabase.from('expenses').update(row).eq('id', expense.id)
      : await supabase.from('expenses').insert(row)
    setSaving(null)
    if (error) setError(error.message)
    else onDone(true)
  }

  async function remove() {
    if (!expense || !confirm('Zmazať výdavok? Súbor v Drive ostane.')) return
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) setError(error.message)
    else onDone(true)
  }

  const input = 'w-full h-11 px-3 rounded-lg border line bg-transparent'
  return (
    <div className="grid gap-4">
      {saving && <BusyOverlay title={saving} progress={progress} />}
      <label className="grid gap-1 text-sm">
        <span className="muted">Doklad (fotka alebo PDF){expense?.drive_file_url ? ' – nahradí existujúci' : ''}</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="text-sm file:mr-3 file:h-10 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--color-ink)] file:text-white file:font-semibold"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>

      <ReceiptViewer localUrl={preview} isPdf={file?.type === 'application/pdf'} driveUrl={file ? null : expense?.drive_file_url ?? null} />

      <div className="flex flex-wrap gap-1">
        {DOC_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDocType(t)}
            className={'h-9 px-3 rounded-lg border line text-sm ' + (docType === t ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')}
          >
            {DOC_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm"><span className="muted">Suma €</span>
          <input type="text" inputMode="decimal" className={input + ' font-semibold'} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></label>
        <label className="grid gap-1 text-sm"><span className="muted">Dátum</span>
          <input type="date" className={input} value={day} onChange={(e) => setDay(e.target.value)} /></label>
      </div>
      <label className="grid gap-1 text-sm"><span className="muted">Obchod / popis (krátko)</span>
        <input className={input} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="napr. Shell tankovanie" /></label>

      {!fixedEventId && (
        <label className="grid gap-1 text-sm"><span className="muted">Event</span>
          <select className={input} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— bez eventu —</option>
            {events.map((e) => <option key={e.id} value={e.id}>{fmtRange(e)} · {e.title}</option>)}
          </select></label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm"><span className="muted">Zaplatil</span>
          <input className={input} value={paidBy} onChange={(e) => setPaidBy(e.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="muted">Kontrola</span>
          <input className={input} value={control} onChange={(e) => setControl(e.target.value)} /></label>
      </div>

      {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={!!saving} className="h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60">
          Uložiť
        </button>
        <button onClick={() => onDone(false)} className="h-11 px-4 rounded-lg border line">Zrušiť</button>
        {expense && <button onClick={remove} className="h-11 px-3 ml-auto text-sm text-[var(--color-signal)]">Zmazať</button>}
      </div>
    </div>
  )
}
