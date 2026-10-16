import { useAuth } from '../lib/auth'

export function Login() {
  const { signIn } = useAuth()
  return (
    <div className="min-h-full grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Red Bull · Event Car</p>
        <h1 className="page-title !text-5xl mt-2">Event Hub</h1>
        <p className="muted mt-3">Eventy, technika, kartóny a financie na jednom mieste.</p>
        <button onClick={signIn} className="btn btn-primary btn-block !h-12 mt-8">
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.55 2.7 12 2.7 6.92 2.7 2.8 6.82 2.8 11.9s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z" /></svg>
          Prihlásiť sa cez Google
        </button>
        <p className="text-xs muted mt-4 text-center">Prístup schvaľuje administrátor.</p>
      </div>
    </div>
  )
}
