// Exporty do Excelu (.xlsx). Generuje sa v prehliadači z dát v databáze (RLS platí ako pri zobrazení).
// exceljs je veľký, preto sa načíta až pri exporte.
import { supabase } from './supabase'
import { type Department, type EventType, dayOf, diffDays, endDay, monthName, startDay } from './events'
import { DOC_LABEL, type DocType, monthRange, withTax } from './finance'

const DPT_CODE: Record<Department, string> = { ec: 'EC', culture: 'CUL', sport: 'SPORT', onpremise: 'ONP' }
const dpt = (d: Department[] | null | undefined) => (d ?? []).map((x) => DPT_CODE[x]).join('/')

// Hodnota pre Excel: dátum bez časového pásma (YYYY-MM-DD → polnoc UTC).
const xlDate = (day: string) => new Date(day + 'T00:00:00Z')

const monthsBetween = (from: string, to: string) => {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

export const periodLabel = (from: string, to: string) => (from === to ? from : `${from}_${to}`)

type Cell = string | number | Date | null | { text: string; hyperlink: string }

async function newBook() {
  const ExcelJS = (await import('exceljs')).default
  return new ExcelJS.Workbook()
}

type Sheet = import('exceljs').Worksheet

function styleHeader(row: import('exceljs').Row) {
  row.font = { bold: true }
  row.alignment = { vertical: 'middle' }
  row.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
    c.border = { bottom: { style: 'thin' } }
  })
}

function fitColumns(ws: Sheet, min = 8, max = 60) {
  ws.columns.forEach((col) => {
    let w = min
    col.eachCell?.({ includeEmpty: false }, (c) => {
      const v = c.value
      const len = v == null ? 0 : v instanceof Date ? 10 : typeof v === 'object' ? String((v as { text?: string }).text ?? '').length : String(v).length
      w = Math.max(w, Math.min(max, len + 2))
    })
    col.width = w
  })
}

async function download(wb: import('exceljs').Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ---------------------------------------------------------------- EVENT CAR / SUPPORT / ADHOC

type EventExportRow = {
  id: string
  title: string
  start_date: string
  end_date: string | null
  event_type: EventType
  departments: Department[]
  location: string | null
  spectators: number | null
  description: string | null
  event_vehicles: { is_primary: boolean; vehicles: { name: string } | null }[]
  event_drivers: { position: number; drivers: { name: string } | null }[]
  event_equipment: { quantity: number; equipment: { name: string } | null }[]
}

export async function loadEvents(from: string, to: string) {
  const [start] = monthRange(from)
  const [, end] = monthRange(to)
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, title, start_date, end_date, event_type, departments, location, spectators, description, ' +
        'event_vehicles(is_primary, vehicles(name)), event_drivers(position, drivers(name)), event_equipment(quantity, equipment(name))',
    )
    .neq('status', 'cancelled')
    .gte('start_date', start + 'T00:00:00Z')
    .lt('start_date', end + 'T00:00:00Z')
    .order('start_date')
    .range(0, 4999)
  if (error) throw error
  return data as unknown as EventExportRow[]
}

const vehicleNames = (e: EventExportRow) =>
  [...e.event_vehicles].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((v) => v.vehicles?.name).filter(Boolean).join(', ')
const driverNames = (e: EventExportRow) =>
  [...e.event_drivers].sort((a, b) => a.position - b.position).map((d) => d.drivers?.name).filter(Boolean).join(', ')
const equipmentText = (e: EventExportRow) =>
  [...e.event_equipment]
    .filter((x) => x.equipment)
    .sort((a, b) => a.equipment!.name.localeCompare(b.equipment!.name))
    .map((x) => (x.quantity > 1 ? `${x.quantity}× ` : '') + x.equipment!.name.replace(/^[^:]{2,20}:\s*/, ''))
    .join(', ')

export async function exportEventCar(from: string, to: string) {
  const events = await loadEvents(from, to)
  const wb = await newBook()

  const addSheet = (name: string, type: EventType, headers: string[], row: (e: EventExportRow) => Cell[]) => {
    const ws = wb.addWorksheet(name)
    styleHeader(ws.addRow(headers))
    for (const e of events.filter((x) => x.event_type === type)) ws.addRow(row(e))
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.getColumn(1).numFmt = 'dd.mm.yyyy'
    fitColumns(ws)
    return ws
  }

  const days = (e: EventExportRow) => diffDays(startDay(e), endDay(e)) + 1
  const ec = addSheet(
    'EVENT CAR',
    'event_car',
    ['Dátum', 'Dátum koniec', 'Počet dní', 'Technika', 'Event Car', 'Názov', 'Driver', 'Lokalita', 'dpt', 'Spectators'],
    (e) => [xlDate(startDay(e)), xlDate(endDay(e)), days(e), equipmentText(e), vehicleNames(e), e.title, driverNames(e), e.location, dpt(e.departments), e.spectators],
  )
  ec.getColumn(2).numFmt = 'dd.mm.yyyy'

  const sup = addSheet(
    'SUPPORT',
    'support',
    ['Dátum', 'Dátum koniec', 'Počet dní', 'Technika', 'Event Car', 'Názov', 'Popis', 'Driver', 'Lokalita', 'dpt', 'Spectators'],
    (e) => [xlDate(startDay(e)), xlDate(endDay(e)), days(e), equipmentText(e), vehicleNames(e), e.title, e.description, driverNames(e), e.location, dpt(e.departments), e.spectators],
  )
  sup.getColumn(2).numFmt = 'dd.mm.yyyy'

  addSheet('ADHOC', 'adhoc', ['Dátum', 'Vozidlo', 'Názov', 'Driver', 'Lokalita', 'dpt'], (e) => [
    xlDate(startDay(e)), vehicleNames(e), e.title, driverNames(e), e.location, dpt(e.departments),
  ])

  await download(wb, `EVENT_CAR_${periodLabel(from, to)}.xlsx`)
  return { events: events.length }
}

// ---------------------------------------------------------------- FINANCE (Vyúčtovanie, hárok na mesiac)

type ExpenseExportRow = {
  date: string
  doc_type: DocType | null
  amount: number
  description: string | null
  control: string | null
  department: string | null
  drive_file_url: string | null
  drive_file_name: string | null
  events: { title: string; departments: Department[] } | null
}
type PayoutExportRow = {
  amount: number
  tax_rate: number
  drivers: { name: string } | null
  events: { title: string; start_date: string; departments: Department[] } | null
}

const eurText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} EUR`

export async function exportFinance(from: string, to: string) {
  const wb = await newBook()
  let docs = 0
  let total = 0

  for (const month of monthsBetween(from, to)) {
    const [s, e] = monthRange(month)
    const [ex, po] = await Promise.all([
      supabase
        .from('expenses')
        .select('date, doc_type, amount, description, control, department, drive_file_url, drive_file_name, events(title, departments)')
        .gte('date', s).lt('date', e).order('date').range(0, 4999),
      supabase
        .from('driver_payouts')
        .select('amount, tax_rate, drivers(name), events!inner(title, start_date, departments)')
        .gte('events.start_date', s + 'T00:00:00Z').lt('events.start_date', e + 'T00:00:00Z').range(0, 4999),
    ])
    if (ex.error) throw ex.error
    if (po.error) throw po.error

    type Line = { date: string; type: string; amount: number; event: string; dpt: string; desc: string; control: string; file: Cell }
    const lines: Line[] = [
      ...(ex.data as unknown as ExpenseExportRow[]).map((r): Line => ({
        date: r.date,
        type: r.doc_type ? DOC_LABEL[r.doc_type] : '',
        amount: Number(r.amount),
        event: r.events?.title ?? '',
        dpt: r.department || dpt(r.events?.departments),
        desc: r.description ?? '',
        control: r.control ?? '',
        file: r.drive_file_url ? { text: r.drive_file_name ?? 'doklad', hyperlink: r.drive_file_url } : null,
      })),
      ...(po.data as unknown as PayoutExportRow[]).map((r): Line => ({
        date: dayOf(r.events?.start_date),
        type: DOC_LABEL.brigadnik,
        amount: withTax(r),
        event: r.events?.title ?? '',
        dpt: dpt(r.events?.departments),
        desc: `${r.drivers?.name ?? '?'} - ${eurText(Number(r.amount))} + ${Math.round(Number(r.tax_rate) * 100)}%`,
        control: '',
        file: null,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    const [y, m] = month.split('-').map(Number)
    const ws = wb.addWorksheet(`${String(m).padStart(2, '0')}-${y}`)
    ws.addRow([`Vyúčtovanie ${monthName(m - 1)} ${y}`]).font = { bold: true, size: 14 }
    const sum = lines.reduce((t, l) => t + l.amount, 0)
    const sumRow = ws.addRow(['Spolu']) // doplní sa nižšie
    ws.addRow([`Scany dokladov: Google Drive → Event Hub / Účty / ${month}`])
    ws.addRow([])
    styleHeader(ws.addRow(['Dátum', 'Typ dokladu', 'Suma', 'Event', 'DPT', 'Popis', 'Kontrola', 'Bloček']))
    const first = ws.rowCount + 1
    for (const l of lines) ws.addRow([xlDate(l.date), l.type, Math.round(l.amount * 100) / 100, l.event, l.dpt, l.desc, l.control, l.file])
    const last = ws.rowCount
    sumRow.getCell(3).value = lines.length ? { formula: `SUM(C${first}:C${last})`, result: Math.round(sum * 100) / 100 } : 0
    sumRow.font = { bold: true }
    ws.getColumn(1).numFmt = 'dd.mm.yyyy'
    ws.getColumn(3).numFmt = '#,##0.00'
    ws.views = [{ state: 'frozen', ySplit: 5 }]
    ws.eachRow((row) => row.eachCell((c) => {
      if (c.value && typeof c.value === 'object' && 'hyperlink' in c.value) c.font = { color: { argb: 'FF1155CC' }, underline: true }
    }))
    fitColumns(ws)
    ws.getColumn(1).width = 12
    docs += lines.length
    total += sum
  }

  await download(wb, `FINANCE_${periodLabel(from, to)}.xlsx`)
  return { docs, total: Math.round(total * 100) / 100 }
}
