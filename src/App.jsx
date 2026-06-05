import { useEffect, useState, useCallback } from 'react'
import { getStoredAuth, handleCallback, clearAuth } from './auth.js'
import { fetchCurrentUser } from './api.js'
import LoginPage from './components/LoginPage.jsx'
import CallbackPage from './components/CallbackPage.jsx'
import MainLayout from './components/MainLayout.jsx'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const path = window.location.pathname

  useEffect(() => {
    const auth = getStoredAuth()
    if (auth) {
      fetchCurrentUser()
        .then(() => setAuthed(true))
        .catch(() => {
          clearAuth()
          setAuthed(false)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const onLogout = useCallback(() => {
    clearAuth()
    setAuthed(false)
  }, [])

  const onAuthComplete = useCallback(() => {
    setAuthed(true)
  }, [])

  if (path === '/callback') {
    return <CallbackPage onComplete={onAuthComplete} />
  }

  if (loading) return <LoadingScreen />

  if (!authed) return <LoginPage />

  return <MainLayout onLogout={onLogout} />
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
    </div>
  )
}
