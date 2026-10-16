import { useEffect, useState } from 'react'
import { Copy, Eye, Plus, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Empty, Section } from './ui'
import { addDays, endDay, fmtDay, type EventRow } from '../lib/events'

type Token = { id: string; token: string; expires_at: string | null; created_at: string }

const newToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Admin: vytvorí verejný odkaz pre vodiča (bez financií). Platí do konca eventu + 3 dni (aspoň 1 deň od vytvorenia). */
export function BriefShare({ ev }: { ev: Pick<EventRow, 'id' | 'start_date' | 'end_date'> }) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    supabase
      .from('briefing_tokens')
      .select('id, token, expires_at, created_at')
      .eq('event_id', ev.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => setTokens((data ?? []) as Token[]))
  }, [ev.id, reload])

  const link = (t: Token) => `${window.location.origin}/brief/${t.token}`

  async function create() {
    setBusy(true)
    setMsg(null)
    const byRule = new Date(addDays(endDay(ev), 3) + 'T23:59:59Z')
    const min = new Date(Date.now() + 24 * 3600_000)
    const expires = byRule > min ? byRule : min
    const { error } = await supabase.from('briefing_tokens').insert({ event_id: ev.id, token: newToken(), expires_at: expires.toISOString() })
    setBusy(false)
    if (error) setMsg(error.message)
    else setReload((r) => r + 1)
  }

  async function copy(t: Token) {
    try {
      await navigator.clipboard.writeText(link(t))
      setMsg('Odkaz je skopírovaný.')
    } catch {
      setMsg(link(t))
    }
  }

  async function share(t: Token) {
    if (navigator.share) {
      try { await navigator.share({ url: link(t) }); return } catch { /* zrušené */ }
    }
    copy(t)
  }

  async function revoke(t: Token) {
    if (!confirm('Zrušiť odkaz? Vodič ho už neotvorí.')) return
    await supabase.from('briefing_tokens').update({ revoked: true, revoked_at: new Date().toISOString() }).eq('id', t.id)
    setReload((r) => r + 1)
  }

  return (
    <Section
      title="Pošli vodičovi"
      sub="Verejný odkaz bez prihlásenia a bez financií. Vodič si ho môže uložiť ako PDF."
      action={<button onClick={create} disabled={busy} className="btn btn-sm"><Plus aria-hidden />Odkaz</button>}
    >
      {tokens.length === 0 ? (
        <Empty>Žiadny platný odkaz.</Empty>
      ) : (
        <ul className="grid gap-2">
          {tokens.map((t) => (
            <li key={t.id} className="rounded-[var(--ctl-r)] bg-[var(--fill)] p-3 text-sm">
              <p className="break-all text-xs font-mono">{link(t)}</p>
              <p className="muted text-xs mt-1">platí do {t.expires_at ? fmtDay(t.expires_at.slice(0, 10)) : '–'}</p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <button onClick={() => share(t)} className="btn btn-sm btn-primary"><Share2 aria-hidden />Poslať</button>
                <button onClick={() => copy(t)} className="btn btn-sm"><Copy aria-hidden />Kopírovať</button>
                <a href={link(t)} target="_blank" rel="noreferrer" className="btn btn-sm"><Eye aria-hidden />Náhľad</a>
                <button onClick={() => revoke(t)} className="btn btn-sm btn-danger ml-auto">Zrušiť</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-sm mt-2 break-all">{msg}</p>}
    </Section>
  )
}
