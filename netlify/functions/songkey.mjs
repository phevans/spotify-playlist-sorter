// Server-side proxy for GetSongBPM key lookups.
//
// The API is CORS-open, so the browser could call it directly — but the API
// key would then have to ship in the client bundle, where anyone could lift
// it. Their terms suspend accounts for abuse, so the key stays server-side.
//
// Docs: https://getsongkey.com/api  (base URL is api.getsong.co, NOT
// api.getsongbpm.com — the old host redirects into a Cloudflare challenge
// that never resolves for non-browser clients.)

const API_KEY = process.env.GETSONGBPM_KEY
const BASE = 'https://api.getsong.co/search/'

// Guard against this becoming an open search proxy for arbitrary queries.
const MAX_LEN = 200

function json(body, status, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Keys are immutable, so let the CDN absorb repeats and keep us well
      // inside the documented 3000 requests/hour limit.
      'cache-control': cache
        ? 'public, max-age=86400, s-maxage=2592000'
        : 'no-store',
    },
  })
}

// Spotify titles carry qualifiers that GetSongBPM's index doesn't use, and
// they tank the match rate: "Song - 2011 Remaster", "Song (feat. X)".
function cleanTitle(title) {
  return title
    .replace(/\s*[([][^)\]]*\b(feat|ft|with)\b[^)\]]*[)\]]/gi, '')
    .replace(/\s*-\s*(\d{4}\s+)?(remaster|remastered|radio edit|single version|mono|stereo|live|acoustic|instrumental)\b.*$/i, '')
    .trim()
}

export default async (req) => {
  const params = new URL(req.url).searchParams
  const title = (params.get('title') || '').slice(0, MAX_LEN).trim()
  const artist = (params.get('artist') || '').slice(0, MAX_LEN).trim()

  if (!title || !artist) {
    return json({ error: 'title and artist are required' }, 400)
  }
  if (!API_KEY) {
    return json({ error: 'GETSONGBPM_KEY is not configured' }, 503)
  }

  // type=both is the only mode that accepts an artist alongside a title;
  // type=song ignores the "artist:" prefix and matches on title alone.
  const url =
    `${BASE}?type=both&lookup=` +
    encodeURIComponent(`song:${cleanTitle(title)} artist:${artist}`)

  let data
  try {
    const res = await fetch(url, {
      // Header auth keeps the key out of URLs, and therefore out of any
      // intermediary access logs.
      headers: { 'X-API-KEY': API_KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 429) return json({ error: 'rate limited' }, 429)
    if (!res.ok) return json({ error: `upstream ${res.status}` }, 502)
    data = await res.json()
  } catch {
    return json({ error: 'upstream unavailable' }, 502)
  }

  // A miss comes back as `{ search: { error: "no result" } }` rather than an
  // empty array, so check the shape before indexing.
  const hit = Array.isArray(data?.search) ? data.search[0] : null

  // open_key is already Traktor/Open Key notation, which is what the UI
  // wants; key_of ("F♯m") is the fallback the client converts itself.
  return json(
    { open_key: hit?.open_key ?? null, key_of: hit?.key_of ?? null },
    200,
    true,
  )
}
