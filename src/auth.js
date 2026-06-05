const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI

const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

const STORAGE_KEY = 'spotify_auth'

function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generatePKCE() {
  const verifier = base64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64urlEncode(hash)
  return { verifier, challenge }
}

export async function startLogin() {
  const { verifier, challenge } = await generatePKCE()
  sessionStorage.setItem('pkce_verifier', verifier)

  const state = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)))
  sessionStorage.setItem('oauth_state', state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function handleCallback(code, state) {
  const storedState = sessionStorage.getItem('oauth_state')
  if (state !== storedState) throw new Error('OAuth state mismatch')

  const verifier = sessionStorage.getItem('pkce_verifier')
  if (!verifier) throw new Error('Missing PKCE verifier')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)

  const data = await res.json()
  saveTokens(data)
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('oauth_state')
}

function saveTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token,
    refresh_token,
    expires_at: Date.now() + expires_in * 1000,
  }))
}

export function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

let refreshPromise = null

export async function getAccessToken() {
  const auth = getStoredAuth()
  if (!auth) return null

  if (Date.now() < auth.expires_at - 60_000) {
    return auth.access_token
  }

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = doRefresh(auth.refresh_token).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function doRefresh(refreshToken) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })

  if (!res.ok) {
    clearAuth()
    throw new Error('Token refresh failed')
  }

  const data = await res.json()
  // Spotify may not return a new refresh token; keep the old one if absent
  if (!data.refresh_token) data.refresh_token = refreshToken
  saveTokens(data)
  return data.access_token
}
