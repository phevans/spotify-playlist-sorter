import { useEffect, useRef, useState } from 'react'
import { handleCallback } from '../auth.js'
import { takeReturnPath } from '../route.js'

export default function CallbackPage({ onComplete }) {
  const called = useRef(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const errorParam = params.get('error')

    if (errorParam) {
      setError(`Spotify denied access: ${errorParam}`)
      return
    }

    if (!code) {
      setError('No authorization code received.')
      return
    }

    handleCallback(code, state)
      .then(() => {
        window.history.replaceState({}, '', takeReturnPath())
        onComplete()
      })
      .catch(err => setError(err.message))
  }, [onComplete])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--red)' }}>{error}</p>
        <a href="/" style={{ color: 'var(--green)' }}>Back to login</a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--text-muted)' }}>Completing login…</p>
    </div>
  )
}
