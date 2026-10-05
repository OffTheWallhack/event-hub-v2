import { useAuth } from '../lib/auth'

export function Pending() {
  const { profile, signOut, refreshProfile } = useAuth()
  return (
    <div className="min-h-full grid place-items-center px-5">
      <div className="card p-6 w-full max-w-sm">
        <h1 className="display text-3xl font-bold">Čakáš na schválenie</h1>
        <p className="muted mt-2">
          Účet <strong>{profile?.email}</strong> je zaregistrovaný. Keď ťa administrátor schváli, appka sa ti odomkne.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={refreshProfile} className="flex-1 h-11 rounded-xl font-semibold text-white bg-[var(--color-ink)] dark:bg-[var(--color-signal)]">
            Skontrolovať znova
          </button>
          <button onClick={signOut} className="h-11 px-4 rounded-xl border line">Odhlásiť</button>
        </div>
      </div>
    </div>
  )
}
