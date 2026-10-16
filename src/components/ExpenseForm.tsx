import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Chips, ErrorText, Field } from './ui'
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

  return (
    <div className="form">
      {saving && <BusyOverlay title={saving} progress={progress} />}
      <div className="field">
        <span className="field-label">Doklad (fotka alebo PDF){expense?.drive_file_url ? ' – nahradí existujúci' : ''}</span>
        <label className="btn justify-start">
          <Camera aria-hidden />
          <span className="truncate font-medium">{file ? file.name : expense?.drive_file_url ? 'Vybrať nový doklad' : 'Odfotiť alebo vybrať doklad'}</span>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <ReceiptViewer localUrl={preview} isPdf={file?.type === 'application/pdf'} driveUrl={file ? null : expense?.drive_file_url ?? null} />

      <div className="field">
        <span className="field-label">Typ dokladu</span>
        <Chips options={DOC_TYPES.map((t) => [t, DOC_LABEL[t]] as const)} isOn={(t) => docType === t} onPick={setDocType} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Suma €">
          <input type="text" inputMode="decimal" className="input font-semibold" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Dátum"><input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
      </div>
      <Field label="Obchod / popis (krátko)">
        <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="napr. Shell tankovanie" />
      </Field>

      {!fixedEventId && (
        <Field label="Event">
          <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— bez eventu —</option>
            {events.map((e) => <option key={e.id} value={e.id}>{fmtRange(e)} · {e.title}</option>)}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Zaplatil"><input className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} /></Field>
        <Field label="Kontrola"><input className="input" value={control} onChange={(e) => setControl(e.target.value)} /></Field>
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="form-actions">
        <button onClick={save} disabled={!!saving} className="btn btn-primary">Uložiť</button>
        <button onClick={() => onDone(false)} className="btn btn-quiet">Zrušiť</button>
        {expense && <button onClick={remove} className="btn btn-danger ml-auto"><Trash2 aria-hidden />Zmazať</button>}
      </div>
    </div>
  )
}
