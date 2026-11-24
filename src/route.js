// The selected playlist lives in the URL as /playlist/<id>, so it survives a refresh and
// Back/Forward step through playlists. Netlify's `/*` rewrite and Vite's SPA fallback both
// serve index.html for these paths.

const PLAYLIST_RE = /^\/playlist\/([A-Za-z0-9]+)\/?$/
const RETURN_KEY = 'return_to'

export function playlistIdFromPath(pathname = window.location.pathname) {
  return pathname.match(PLAYLIST_RE)?.[1] ?? null
}

export const playlistPath = (id) => (id ? `/playlist/${id}` : '/')

/** Before leaving for Spotify's login: remember where to come back to. */
export function rememberReturnPath() {
  const path = window.location.pathname
  if (PLAYLIST_RE.test(path)) sessionStorage.setItem(RETURN_KEY, path)
  else sessionStorage.removeItem(RETURN_KEY)
}

/** After login: the path to return to (only a playlist path, never anything else), or '/'. */
export function takeReturnPath() {
  const path = sessionStorage.getItem(RETURN_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  return path && PLAYLIST_RE.test(path) ? path : '/'
}
