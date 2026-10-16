import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { supabase, SUPABASE_URL } from '../lib/supabase'

/** To-Do → odkaz na kalendár do iPhonu. Úlohy s termínom alebo pripomienkou sa objavia v Kalendári. */
export function CalendarBox() {
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function get(action: 'link' | 'rotate') {
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.functions.invoke('todo-ics', { body: { action } })
    setBusy(false)
    if (error) return setMsg(error.message)
    setToken(data.token as string)
    if (action === 'rotate') setMsg('Starý odkaz už nefunguje, pridaj do kalendára nový.')
  }

  const host = SUPABASE_URL.replace(/^https?:\/\//, '')
  const path = token ? `${host}/functions/v1/todo-ics?t=${token}` : ''

  async function copy() {
    try { await navigator.clipboard.writeText('https://' + path); setMsg('Odkaz je skopírovaný.') } catch { setMsg('Odkaz skopíruj ručne z poľa.') }
  }

  return (
    <details className="card section text-sm group">
      <summary className="flex items-center gap-3 font-semibold select-none">
        <CalendarDays className="w-5 h-5 muted" aria-hidden /><span className="flex-1">Úlohy v kalendári iPhonu</span>
        <ChevronDown className="w-5 h-5 muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <p className="muted mt-3">Úlohy s termínom alebo pripomienkou sa zobrazia v aplikácii Kalendár a iPhone ti o nich dá upozornenie (termín = 9:00 v ten deň). Aktualizuje sa sám.</p>
      {!token ? (
        <button onClick={() => get('link')} disabled={busy} className="btn btn-sm btn-primary mt-3">Zobraziť odkaz</button>
      ) : (
        <div className="mt-3 grid gap-2">
          <a href={'webcal://' + path} className="btn btn-primary">Pridať do Kalendára (iPhone)</a>
          <input readOnly value={'https://' + path} onFocus={(e) => e.currentTarget.select()} className="input !text-xs font-mono" />
          <div className="flex gap-2">
            <button onClick={copy} className="btn btn-sm">Kopírovať odkaz</button>
            <button onClick={() => { if (confirm('Starý odkaz prestane fungovať. Pokračovať?')) get('rotate') }} disabled={busy} className="btn btn-sm">Vymeniť za nový</button>
          </div>
          <p className="muted text-xs">Odkaz je tajný – nikomu ho neposielaj. Kto ho má, vidí tvoje úlohy.</p>
        </div>
      )}
      {msg && <p className="mt-2">{msg}</p>}
    </details>
  )
}
