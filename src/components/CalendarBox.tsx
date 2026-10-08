import { useState } from 'react'
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
    <details className="card p-4 text-sm">
      <summary className="font-semibold cursor-pointer select-none">📅 Úlohy v kalendári iPhonu</summary>
      <p className="muted mt-2">Úlohy s termínom alebo pripomienkou sa zobrazia v aplikácii Kalendár a iPhone ti o nich dá upozornenie (termín = 9:00 v ten deň). Aktualizuje sa sám.</p>
      {!token ? (
        <button onClick={() => get('link')} disabled={busy} className="mt-3 h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60">Zobraziť odkaz</button>
      ) : (
        <div className="mt-3 grid gap-2">
          <a href={'webcal://' + path} className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)] inline-flex items-center justify-center">Pridať do Kalendára (iPhone)</a>
          <input readOnly value={'https://' + path} onFocus={(e) => e.currentTarget.select()} className="h-10 px-2 rounded-lg border line bg-transparent text-xs w-full" />
          <div className="flex gap-2">
            <button onClick={copy} className="h-9 px-3 rounded-lg border line">Kopírovať odkaz</button>
            <button onClick={() => { if (confirm('Starý odkaz prestane fungovať. Pokračovať?')) get('rotate') }} disabled={busy} className="h-9 px-3 rounded-lg border line">Vymeniť za nový</button>
          </div>
          <p className="muted text-xs">Odkaz je tajný – nikomu ho neposielaj. Kto ho má, vidí tvoje úlohy.</p>
        </div>
      )}
      {msg && <p className="mt-2">{msg}</p>}
    </details>
  )
}
