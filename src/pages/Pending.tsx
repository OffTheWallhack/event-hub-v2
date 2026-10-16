import { useAuth } from '../lib/auth'

export function Pending() {
  const { profile, signOut, refreshProfile } = useAuth()
  return (
    <div className="min-h-full grid place-items-center px-6">
      <div className="card section w-full max-w-sm !p-6">
        <h1 className="page-title !text-2xl">Čakáš na schválenie</h1>
        <p className="muted mt-2">
          Účet <strong className="text-[var(--fg)]">{profile?.email}</strong> je zaregistrovaný. Keď ťa administrátor schváli, appka sa ti odomkne.
        </p>
        <div className="flex gap-2 mt-6">
          <button onClick={refreshProfile} className="btn btn-primary flex-1">Skontrolovať znova</button>
          <button onClick={signOut} className="btn">Odhlásiť</button>
        </div>
      </div>
    </div>
  )
}
