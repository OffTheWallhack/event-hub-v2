import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import './styles.css'
import { AuthProvider, useAuth } from './lib/auth'
import { applyTheme, getTheme } from './lib/theme'
import { router } from './router'
import { Login } from './pages/Login'
import { Pending } from './pages/Pending'
import { BriefPage } from './pages/BriefPage'

applyTheme(getTheme())

function App() {
  const { loading, session, profile, isAdmin } = useAuth()
  if (loading) return <div className="min-h-full grid place-items-center muted">Načítavam…</div>
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
