export type TodoScope = 'general' | 'vehicle' | 'garage'
export type TodoStatus = 'open' | 'in_progress' | 'done'

export type Todo = {
  id: string
  scope: TodoScope
  vehicle_id: string | null
  text: string
  status: TodoStatus
  priority: number
  due_date: string | null
  remind_at: string | null
  created_at: string
}

export type VehicleOpt = { id: string; name: string }

export const TODO_COLUMNS = 'id, scope, vehicle_id, text, status, priority, due_date, remind_at, created_at'

export const SCOPE_LABEL: Record<TodoScope, string> = { general: 'Všeobecné', vehicle: 'Auto', garage: 'Garáž' }
export const STATUS_LABEL: Record<TodoStatus, string> = { open: 'Otvorené', in_progress: 'Rozrobené', done: 'Hotové' }

// <input type="datetime-local"> pracuje s lokálnym časom bez pásma
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null)

// Autá, ktoré majú vlastné úlohy a stránku v Garáži (ostatné autá sa pri eventoch používajú, ale úlohy nemajú).
export const GARAGE_VEHICLES = ['Zubor', 'Sugga']
