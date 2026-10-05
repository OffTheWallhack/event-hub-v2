import { useEffect, useState } from 'react'
import { supabase, type Profile, type Role } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const ROLE_LABEL: Record<Role, string> = { pending: 'Čaká', driver: 'Vodič (čítanie)', admin: 'Admin' }

export function Users() {
  const { profile: me } = useAuth()
  const [rows, setRows] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (error) setError(error.message)
    else setRows(data as Profile[])
  }
  useEffect(() => { load() }, [])

  async function setRole(userId: string, role: Role) {
    setSaving(userId)
    const { error } = await supabase.from('profiles').update({ role }).eq('user_id', userId)
    setSaving(null)
    if (error) setError(error.message)
    else load()
  }

  const pending = rows.filter((r) => r.role === 'pending').length

  return (
    <section>
      <h1 className="display text-4xl font-bold">Používatelia</h1>
      <p className="muted mt-1">
        {pending > 0 ? `${pending} čaká na schválenie.` : 'Nikto nečaká na schválenie.'}
      </p>
      {error && <p className="mt-3 text-[var(--color-signal)]">{error}</p>}
      <ul className="mt-4 grid gap-2">
        {rows.map((r) => {
          const isMe = r.user_id === me?.user_id
          return (
            <li key={r.user_id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.name ?? r.email}</p>
                <p className="text-sm muted truncate">{r.email}</p>
              </div>
              {isMe ? (
                <span className="text-sm muted">Ty · {ROLE_LABEL[r.role]}</span>
              ) : (
                <div className="flex gap-1">
                  {(['pending', 'driver', 'admin'] as Role[]).map((role) => (
                    <button
                      key={role}
                      disabled={saving === r.user_id}
                      onClick={() => setRole(r.user_id, role)}
                      className={
                        'px-3 h-9 rounded-lg text-sm border line ' +
                        (r.role === role ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)]' : '')
                      }
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
