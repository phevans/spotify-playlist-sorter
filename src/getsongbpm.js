import { cacheGet, cacheSet } from './cache.js'

// Lookups go through our own Netlify function rather than straight to
// GetSongBPM: their API sends no CORS headers and sits behind a Cloudflare
// challenge, so a direct browser fetch is blocked. See netlify/functions/songkey.mjs
const ENDPOINT = '/api/songkey'
const TTL = 30 * 24 * 60 * 60 * 1000 // 30 days — keys don't change

const NOTE_TO_PITCH = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}
const MAJOR_KEY = [1, 8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6]
const MINOR_KEY = [10, 5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3]

// Accepts "G", "Bm", "F#m", "Bb", "C# Minor", "G Major" etc.
function toOpenKey(keyStr) {
  if (!keyStr) return null
  const s = keyStr
    // The API uses the typographic ♯/♭ (U+266F/U+266D), not ASCII.
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/\s+(major|maj)\s*$/i, '')
    .replace(/\s+(minor|min)\s*$/i, 'm')
    .trim()
  const isMinor = s.endsWith('m')
  const note = isMinor ? s.slice(0, -1) : s
  const pitch = NOTE_TO_PITCH[note]
  if (pitch === undefined) return null
  return isMinor ? `${MINOR_KEY[pitch]}m` : `${MAJOR_KEY[pitch]}d`
}

// GetSongBPM has no Spotify-ID lookup — it is a title/artist text search —
// so we cache against the Spotify id but query by name.
async function lookupTrackKey(track) {
  const cacheKey = `gsbpm:${track.id}`
  const cached = cacheGet(cacheKey)
  if (cached !== undefined) return cached // null means "confirmed not found"

  const artist = track.artists?.[0]?.name
  if (!track.name || !artist) return null

  const query = new URLSearchParams({ title: track.name, artist })

  try {
    const res = await fetch(`${ENDPOINT}?${query}`)
    // 429/502/503 mean the lookup never happened (rate limited, upstream
    // down, key missing). Return without caching so it retries, rather than
    // poisoning the cache with a 30-day "no key" for a track that has one.
    if (!res.ok) return null
    const { open_key, key_of } = await res.json()
    // open_key is already in Open Key notation; key_of ("F♯m") needs converting.
    const key = open_key || (key_of ? toOpenKey(key_of) : null)
    cacheSet(cacheKey, key, TTL)
    return key
  } catch {
    return null
  }
}

// Calls onKey(trackId, openKeyString) as each result arrives.
// Cached tracks resolve immediately; uncached ones fetch sequentially to stay
// inside GetSongBPM's 3000 requests/hour limit.
export async function fetchTrackKeys(tracks, onKey) {
  for (const track of tracks) {
    const key = await lookupTrackKey(track)
    if (key) onKey(track.id, key)
  }
}
