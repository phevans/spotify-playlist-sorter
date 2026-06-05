import { cacheGet, cacheSet } from './cache.js'

const API_KEY = import.meta.env.VITE_GETSONGBPM_KEY
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
    .replace(/\s+(major|maj)\s*$/i, '')
    .replace(/\s+(minor|min)\s*$/i, 'm')
    .trim()
  const isMinor = s.endsWith('m')
  const note = isMinor ? s.slice(0, -1) : s
  const pitch = NOTE_TO_PITCH[note]
  if (pitch === undefined) return null
  return isMinor ? `${MINOR_KEY[pitch]}m` : `${MAJOR_KEY[pitch]}d`
}

async function lookupTrackKey(trackId) {
  const cacheKey = `gsbpm:${trackId}`
  const cached = cacheGet(cacheKey)
  if (cached !== undefined) return cached // null means "confirmed not found"

  if (!API_KEY) return null

  try {
    const url = `https://api.getsongbpm.com/search/?api_key=${API_KEY}&type=song&lookup=spotify:track:${trackId}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const song = data?.search?.[0]
    const key = song?.key_of ? toOpenKey(song.key_of) : null
    cacheSet(cacheKey, key, TTL)
    return key
  } catch {
    return null
  }
}

// Calls onKey(trackId, openKeyString) as each result arrives.
// Cached tracks resolve immediately; uncached ones fetch sequentially.
export async function fetchTrackKeys(tracks, onKey) {
  for (const track of tracks) {
    const key = await lookupTrackKey(track.id)
    if (key) onKey(track.id, key)
  }
}
