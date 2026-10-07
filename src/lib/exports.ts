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

// Náhľad: namiesto stiahnutia sa hotový zošit zachytí a ukáže sa na obrazovke.
let sink: ((wb: import('exceljs').Workbook) => void) | null = null

export type SheetPreview = { name: string; rows: string[][]; total: number }

/** Spustí export (napr. () => exportFinance(from, to)) bez sťahovania a vráti hárky s prvými riadkami. */
export async function previewExport(run: () => Promise<unknown>, maxRows = 8): Promise<SheetPreview[]> {
  let captured: import('exceljs').Workbook | null = null
  sink = (wb) => { captured = wb }
  try { await run() } finally { sink = null }
  if (!captured) return []
  const show = (v: unknown): string => {
    if (v == null) return ''
    if (v instanceof Date) return `${v.getUTCDate()}.${v.getUTCMonth() + 1}.${v.getUTCFullYear()}`
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
    if (typeof v === 'object') {
      const o = v as { text?: string; result?: unknown }
      return o.text ?? (o.result != null ? show(o.result) : '')
    }
    return String(v)
  }
  return (captured as import('exceljs').Workbook).worksheets.map((ws) => {
    const rows: string[][] = []
    ws.eachRow((row, n) => {
      if (n > maxRows) return
      const cells: string[] = []
      for (let c = 1; c <= ws.columnCount; c++) cells.push(show(row.getCell(c).value))
      rows.push(cells)
    })
    return { name: ws.name, rows, total: ws.rowCount }
  })
}

async function download(wb: import('exceljs').Workbook, filename: string) {
  if (sink) { sink(wb); return }
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
  event_equipment: { quantity: number; returned_confirmed: boolean; issue: string; equipment: { name: string; category: string } | null }[]
}

export async function loadEvents(from: string, to: string) {
  const [start] = monthRange(from)
  const [, end] = monthRange(to)
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, title, start_date, end_date, event_type, departments, location, spectators, description, ' +
        'event_vehicles(is_primary, vehicles(name)), event_drivers(position, drivers(name)), event_equipment(quantity, returned_confirmed, issue, equipment(name, category))',
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

  addTechnikaSheets(wb, events)

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

// ---------------------------------------------------------------- TECHNIKA

const EQ_TYPES: [RegExp, string][] = [
  [/mic/i, 'Mikrofóny'],
  [/cdj/i, 'CDJ'],
  [/mix|konzol|djm/i, 'Mixpulty / konzoly'],
  [/stojan|tyc|tyč|tripod/i, 'Stojany'],
  [/rcf/i, 'Repráky RCF'],
  [/\bsub/i, 'Suby'],
  [/repro|montarbo|\bdb\b/i, 'Repráky'],
  [/cooler|chlad/i, 'Chladničky'],
  [/playstation/i, 'PlayStation'],
  [/gener/i, 'Generátor'],
  [/kompres/i, 'Kompresor'],
  [/branding|logo|desk|neon|slnecnik|slnečník|kock|tabul|nalep/i, 'Branding'],
]
const eqType = (name: string) => EQ_TYPES.find(([re]) => re.test(name))?.[1] ?? 'Ostatné'
const CATEGORY_NAME: Record<string, string> = { coolers: 'Chladničky', audio: 'Audio', branding: 'Branding', others: 'Ostatné' }
const ISSUE_NAME: Record<string, string> = { none: '', broken: 'pokazené', not_returned: 'nevrátené' }
const typeName = (e: EventExportRow) => TYPE_NAME[e.event_type]
const TYPE_NAME: Record<EventType, string> = { event_car: 'Event Car', support: 'Support', adhoc: 'Adhoc', servis: 'Servis' }

/** Hárky TECHNIKA: po eventoch, súhrn po kusoch, súhrn po type a mesiacoch. */
function addTechnikaSheets(wb: import('exceljs').Workbook, events: EventExportRow[]) {
  const lines = events.flatMap((e) =>
    e.event_equipment.filter((x) => x.equipment).map((x) => ({
      e, name: x.equipment!.name, category: x.equipment!.category, qty: x.quantity,
      returned: x.returned_confirmed, issue: x.issue, days: diffDays(startDay(e), endDay(e)) + 1,
    })),
  )

  const byEvent = wb.addWorksheet('TECHNIKA - EVENTY')
  styleHeader(byEvent.addRow(['Dátum', 'Dátum koniec', 'Dní', 'Event', 'Typ eventu', 'Technika', 'Typ', 'Kusov', 'dpt', 'Vrátené', 'Problém']))
  for (const l of lines) {
    byEvent.addRow([
      xlDate(startDay(l.e)), xlDate(endDay(l.e)), l.days, l.e.title, typeName(l.e), l.name, eqType(l.name), l.qty,
      dpt(l.e.departments), l.returned ? 'áno' : '', ISSUE_NAME[l.issue] ?? '',
    ])
  }
  byEvent.getColumn(1).numFmt = 'dd.mm.yyyy'
  byEvent.getColumn(2).numFmt = 'dd.mm.yyyy'
  byEvent.views = [{ state: 'frozen', ySplit: 1 }]
  byEvent.autoFilter = { from: 'A1', to: 'K1' }
  fitColumns(byEvent)

  const per = new Map<string, { category: string; events: Set<string>; pieces: number; days: number; pieceDays: number; last: string }>()
  for (const l of lines) {
    const cur = per.get(l.name) ?? { category: l.category, events: new Set<string>(), pieces: 0, days: 0, pieceDays: 0, last: '' }
    if (!cur.events.has(l.e.id)) { cur.events.add(l.e.id); cur.days += l.days }
    cur.pieces += l.qty
    cur.pieceDays += l.qty * l.days
    cur.last = startDay(l.e) > cur.last ? startDay(l.e) : cur.last
    per.set(l.name, cur)
  }
  const sum = wb.addWorksheet('TECHNIKA - SÚHRN')
  styleHeader(sum.addRow(['Technika', 'Typ', 'Kategória', 'Eventov', 'Kusov spolu', 'Dní na eventoch', 'Kus-dní', 'Naposledy']))
  for (const [name, v] of [...per.entries()].sort((a, b) => b[1].events.size - a[1].events.size || a[0].localeCompare(b[0]))) {
    sum.addRow([name, eqType(name), CATEGORY_NAME[v.category] ?? v.category, v.events.size, v.pieces, v.days, v.pieceDays, xlDate(v.last)])
  }
  sum.getColumn(8).numFmt = 'dd.mm.yyyy'
  sum.views = [{ state: 'frozen', ySplit: 1 }]
  fitColumns(sum)

  const perType = new Map<string, { month: string; type: string; events: Set<string>; pieces: number; pieceDays: number }>()
  for (const l of lines) {
    const month = startDay(l.e).slice(0, 7)
    const key = `${month}|${eqType(l.name)}`
    const cur = perType.get(key) ?? { month, type: eqType(l.name), events: new Set<string>(), pieces: 0, pieceDays: 0 }
    cur.events.add(l.e.id)
    cur.pieces += l.qty
    cur.pieceDays += l.qty * l.days
    perType.set(key, cur)
  }
  const types = wb.addWorksheet('TECHNIKA - TYPY')
  styleHeader(types.addRow(['Mesiac', 'Typ', 'Eventov', 'Kusov', 'Kus-dní']))
  for (const v of [...perType.values()].sort((a, b) => a.month.localeCompare(b.month) || b.pieces - a.pieces)) {
    types.addRow([v.month, v.type, v.events.size, v.pieces, v.pieceDays])
  }
  types.views = [{ state: 'frozen', ySplit: 1 }]
  fitColumns(types)
}

export async function exportTechnika(from: string, to: string) {
  const events = await loadEvents(from, to)
  const wb = await newBook()
  addTechnikaSheets(wb, events)
  await download(wb, `TECHNIKA_${periodLabel(from, to)}.xlsx`)
  return { events: events.filter((e) => e.event_equipment.length > 0).length, pieces: events.reduce((t, e) => t + e.event_equipment.reduce((s, x) => s + x.quantity, 0), 0) }
}

// ---------------------------------------------------------------- DRIVERS (len admin)

export async function exportDrivers(from: string, to: string) {
  const [start] = monthRange(from)
  const [, end] = monthRange(to)
  const { data, error } = await supabase
    .from('driver_payouts')
    .select('amount, tax_rate, paid, drivers(name), events!inner(title, start_date, end_date)')
    .gte('events.start_date', start + 'T00:00:00Z')
    .lt('events.start_date', end + 'T00:00:00Z')
    .range(0, 4999)
  if (error) throw error
  type Row = { amount: number; tax_rate: number; paid: boolean; drivers: { name: string } | null; events: { title: string; start_date: string; end_date: string | null } }
  const rows = (data as unknown as Row[]).sort((a, b) => a.events.start_date.localeCompare(b.events.start_date))

  const wb = await newBook()
  const sum = wb.addWorksheet('DRIVERS')
  styleHeader(sum.addRow(['Mesiac', 'Vodič', 'Eventov', 'Základ', 'Daň', 'Spolu s daňou', 'Vyplatené', 'Nevyplatené']))
  const agg = new Map<string, { month: string; name: string; n: number; base: number; total: number; paid: number }>()
  for (const r of rows) {
    const month = dayOf(r.events.start_date).slice(0, 7)
    const name = r.drivers?.name ?? '?'
    const k = `${month}|${name}`
    const cur = agg.get(k) ?? { month, name, n: 0, base: 0, total: 0, paid: 0 }
    cur.n++
    cur.base += Number(r.amount)
    cur.total += withTax(r)
    if (r.paid) cur.paid += withTax(r)
    agg.set(k, cur)
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  for (const v of [...agg.values()].sort((a, b) => a.month.localeCompare(b.month) || a.name.localeCompare(b.name))) {
    sum.addRow([v.month, v.name, v.n, r2(v.base), r2(v.total - v.base), r2(v.total), r2(v.paid), r2(v.total - v.paid)])
  }
  const last = sum.rowCount
  const tot = sum.addRow(['Spolu', '', { formula: `SUM(C2:C${last})`, result: [...agg.values()].reduce((t, v) => t + v.n, 0) }])
  for (const [col, key] of [[4, 'base'], [6, 'total']] as const) {
    const L = String.fromCharCode(64 + col)
    tot.getCell(col).value = { formula: `SUM(${L}2:${L}${last})`, result: r2([...agg.values()].reduce((t, v) => t + v[key], 0)) }
  }
  tot.getCell(5).value = { formula: `SUM(E2:E${last})`, result: r2([...agg.values()].reduce((t, v) => t + v.total - v.base, 0)) }
  tot.getCell(7).value = { formula: `SUM(G2:G${last})`, result: r2([...agg.values()].reduce((t, v) => t + v.paid, 0)) }
  tot.getCell(8).value = { formula: `SUM(H2:H${last})`, result: r2([...agg.values()].reduce((t, v) => t + v.total - v.paid, 0)) }
  tot.font = { bold: true }
  for (const c of [4, 5, 6, 7, 8]) sum.getColumn(c).numFmt = '#,##0.00'
  sum.views = [{ state: 'frozen', ySplit: 1 }]
  fitColumns(sum)

  const det = wb.addWorksheet('VÝPLATY')
  styleHeader(det.addRow(['Dátum', 'Event', 'Vodič', 'Základ', 'Daň', 'Spolu s daňou', 'Vyplatené']))
  for (const r of rows) det.addRow([xlDate(dayOf(r.events.start_date)), r.events.title, r.drivers?.name ?? '?', Number(r.amount), r2(withTax(r) - Number(r.amount)), withTax(r), r.paid ? 'áno' : ''])
  det.getColumn(1).numFmt = 'dd.mm.yyyy'
  for (const c of [4, 5, 6]) det.getColumn(c).numFmt = '#,##0.00'
  det.views = [{ state: 'frozen', ySplit: 1 }]
  fitColumns(det)

  await download(wb, `DRIVERS_${periodLabel(from, to)}.xlsx`)
  return { payouts: rows.length, total: r2(rows.reduce((t, r) => t + withTax(r), 0)) }
}

// ---------------------------------------------------------------- PRODUCT (kartóny)

export async function exportProduct(from: string, to: string) {
  const [start] = monthRange(from)
  const [, end] = monthRange(to)
  const [mv, st] = await Promise.all([
    supabase
      .from('carton_movements')
      .select('cartons, type, recipient, note, counts_in_stock, occurred_at, flavors(name, label, sort_order), events(title, departments)')
      .gte('occurred_at', start + 'T00:00:00Z')
      .lt('occurred_at', end + 'T00:00:00Z')
      .order('occurred_at')
      .range(0, 4999),
    supabase.from('carton_stock').select('name, label, sort_order, cartons, active').order('sort_order'),
  ])
  if (mv.error) throw mv.error
  if (st.error) throw st.error
  type Mv = {
    cartons: number; type: string; recipient: string | null; note: string | null; counts_in_stock: boolean; occurred_at: string
    flavors: { name: string; label: string | null; sort_order: number } | null
    events: { title: string; departments: Department[] } | null
  }
  const moves = mv.data as unknown as Mv[]
  const fl = (m: Mv) => m.flavors?.label || m.flavors?.name || '?'
  const TYPE_LABEL_SK: Record<string, string> = {
    delivery: 'Závoz', returned: 'Vrátené', event: 'Na event', opened_garage: 'Otvorené v garáži', damaged: 'Poškodené', adjustment: 'Inventúra / oprava',
  }

  const wb = await newBook()

  const stock = wb.addWorksheet('STAV')
  styleHeader(stock.addRow(['Príchuť', 'Kartóny v sklade']))
  for (const r of st.data as { name: string; label: string | null; cartons: number; active: boolean }[]) {
    if (r.active || r.cartons !== 0) stock.addRow([r.label || r.name, r.cartons])
  }
  stock.addRow(['Spolu', { formula: `SUM(B2:B${stock.rowCount})`, result: (st.data as { cartons: number }[]).reduce((t, r) => t + r.cartons, 0) }]).font = { bold: true }
  fitColumns(stock)

  const list = wb.addWorksheet('POHYBY')
  styleHeader(list.addRow(['Dátum', 'Príchuť', 'Kartóny', 'Typ', 'Event', 'Komu / od koho', 'Poznámka', 'Do skladu']))
  for (const m of moves) {
    list.addRow([xlDate(dayOf(m.occurred_at)), fl(m), m.cartons, TYPE_LABEL_SK[m.type] ?? m.type, m.events?.title ?? '', m.recipient ?? '', m.note ?? '', m.counts_in_stock ? 'áno' : 'len štatistika'])
  }
  list.getColumn(1).numFmt = 'dd.mm.yyyy'
  list.views = [{ state: 'frozen', ySplit: 1 }]
  list.autoFilter = { from: 'A1', to: 'H1' }
  fitColumns(list)

  const cons = wb.addWorksheet('SPOTREBA')
  styleHeader(cons.addRow(['Príchuť', 'Prišlo', 'Na eventy', 'Iné (garáž, poškodené)', '% spotreby z príchodov']))
  const per = new Map<string, { in: number; used: number; other: number }>()
  const dept = new Map<string, number>()
  for (const m of moves) {
    const k = fl(m)
    const p = per.get(k) ?? { in: 0, used: 0, other: 0 }
    if (m.type === 'delivery') p.in += m.cartons
    else if (m.type === 'event') {
      p.used += -m.cartons
      const ds = m.events?.departments?.length ? m.events.departments : []
      if (ds.length === 0) dept.set('neurčené', (dept.get('neurčené') ?? 0) + -m.cartons)
      for (const d of ds) dept.set(DPT_CODE[d], (dept.get(DPT_CODE[d]) ?? 0) + -m.cartons / ds.length)
    } else if (m.type === 'opened_garage' || m.type === 'damaged') p.other += -m.cartons
    per.set(k, p)
  }
  let tIn = 0, tUsed = 0, tOther = 0
  for (const [k, v] of [...per.entries()].sort((a, b) => b[1].used - a[1].used)) {
    if (!v.in && !v.used && !v.other) continue
    cons.addRow([k, v.in, v.used, v.other, v.in ? v.used / v.in : null])
    tIn += v.in; tUsed += v.used; tOther += v.other
  }
  cons.addRow(['Spolu', tIn, tUsed, tOther, tIn ? tUsed / tIn : null]).font = { bold: true }
  cons.getColumn(5).numFmt = '0%'
  fitColumns(cons)

  const dp = wb.addWorksheet('ODDELENIA')
  styleHeader(dp.addRow(['Oddelenie', 'Spotreba (kartóny)', '% z eventovej spotreby']))
  for (const [d, n] of [...dept.entries()].sort((a, b) => b[1] - a[1])) dp.addRow([d, Math.round(n * 10) / 10, tUsed ? n / tUsed : null])
  dp.getColumn(3).numFmt = '0%'
  fitColumns(dp)

  await download(wb, `PRODUCT_${periodLabel(from, to)}.xlsx`)
  return { movements: moves.length }
}
