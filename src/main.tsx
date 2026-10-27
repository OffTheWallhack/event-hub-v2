import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import './styles.css'
import { AuthProvider, useAuth } from './lib/auth'
import { applyMode, applySize, cleanOldSettings, loadMode, loadSize } from './lib/theme'
import { router } from './router'
import { Login } from './pages/Login'
import { Pending } from './pages/Pending'
import { BriefPage } from './pages/BriefPage'
import { Garage3D } from './components/Garage3D'

cleanOldSettings()
applyMode(loadMode())
applySize(loadSize(), false)

function App() {
  const { loading, session, profile, isAdmin } = useAuth()
  if (loading) {
    // úvodná obrazovka: 3D garáž na pozadí (keď je už v pamäti, ukáže sa hneď; inak len tmavé pozadie)
    return (
      <div className="fixed inset-0 bg-[#050507] text-white">
        <Garage3D className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-[max(2.5rem,env(safe-area-inset-bottom))] text-center pointer-events-none">
          <p className="eyebrow !text-white/50">Red Bull · Event Car</p>
          <p className="display text-3xl font-bold mt-1">Event Hub</p>
          <p className="text-xs text-white/40 mt-2">Načítavam…</p>
        </div>
      </div>
    )
  }
  if (!session) return <Login />
  if (!profile || profile.role === 'pending') return <Pending />
  return <RouterProvider router={router} context={{ isAdmin }} />
}

// Verejný odkaz pre vodiča (/brief/<token>) sa zobrazí bez prihlásenia.
const brief = /^\/brief\/([A-Za-z0-9_-]+)\/?$/.exec(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {brief ? (
      <BriefPage token={brief[1]} />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>,
)
