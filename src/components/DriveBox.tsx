import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Badge, Section } from './ui'

type Status = { connected: boolean; email: string | null }

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('drive', { body })
  if (error) {
    let detail = error.message
    try { detail = (await (error as { context?: Response }).context?.json())?.error ?? detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  return data
}

/**
 * Nastavenia → Google Drive. Prepojenie cez Google Apps Script v Robertovom účte:
 * skopíruje kód, nasadí ho ako Web app a vloží sem jeho adresu.
 */
export function DriveBox() {
  const [st, setSt] = useState<Status | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    try { setSt(await call({ action: 'status' })) } catch (e) { setMsg((e as Error).message) }
  }
  useEffect(() => { load() }, [])

  async function copyCode() {
    try {
      const c = code ?? (await call({ action: 'script' })).code
      setCode(c)
      await navigator.clipboard.writeText(c)
      setMsg('Kód je skopírovaný.')
    } catch {
      // niektoré prehliadače nedovolia schránku – kód sa zobrazí na ručné skopírovanie
      setMsg('Kód skopíruj ručne z poľa nižšie.')
    }
  }

  async function connect() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await call({ action: 'connect', url })
      setSt({ connected: true, email: r.email })
      setMsg('Google Drive je prepojený.')
    } catch (e) {
      setMsg((e as Error).message)
    }
    setBusy(false)
  }

  async function disconnect() {
    if (!confirm('Odpojiť Google Drive? Súbory v Drive ostanú.')) return
    await call({ action: 'disconnect' })
    load()
  }

  return (
    <Section
      title="Google Drive"
      sub="Doklady sa ukladajú do priečinka Event Hub / Účty / mesiac."
      action={st?.connected ? <Badge tone="ok">Prepojené</Badge> : st ? <Badge tone="warn">Nepripojené</Badge> : null}
    >
      {!st ? (
        <p className="muted text-sm">Načítavam…</p>
      ) : st.connected ? (
        <div className="flex items-center gap-3">
          <p className="flex-1 min-w-0 text-sm truncate">{st.email ? <>Účet <b>{st.email}</b></> : 'Prepojené.'}</p>
          <button onClick={disconnect} className="btn btn-sm">Odpojiť</button>
        </div>
      ) : (
        <ol className="grid gap-3 text-sm list-decimal pl-5">
          <li>
            <button onClick={copyCode} className="btn btn-sm btn-primary"><Copy aria-hidden />Skopírovať kód skriptu</button>
            {code && (
              <textarea readOnly value={code} rows={5} className="input mt-2 font-mono !text-[11px]" onFocus={(e) => e.target.select()} />
            )}
          </li>
          <li>
            Otvor <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="link">script.google.com ↗</a> (nový projekt),
            zmaž, čo tam je, vlož kód a ulož (ikonka diskety).
          </li>
          <li>
            Vpravo hore <b>Deploy → New deployment</b> → ozubené koliesko → <b>Web app</b>.
            Execute as: <b>Me</b>, Who has access: <b>Anyone</b> → <b>Deploy</b>.
          </li>
          <li>Google sa spýta na povolenie → vyber svoj účet → Advanced → Go to … (unsafe) → Allow. Je to tvoj vlastný skript.</li>
          <li>
            Skopíruj <b>Web app URL</b> a vlož sem:
            <div className="flex gap-2 mt-2">
              <input
                className="input"
                placeholder="https://script.google.com/macros/s/…/exec"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button onClick={connect} disabled={busy || !url.trim()} className="btn btn-primary">
                {busy ? 'Overujem…' : 'Prepojiť'}
              </button>
            </div>
          </li>
        </ol>
      )}
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </Section>
  )
}
