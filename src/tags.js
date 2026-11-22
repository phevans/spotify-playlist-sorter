// Tags shared with TrackTagger (~/Code/spotify-track-tagger, docs/tag-format.md).
//
// A tag is a playlist the user owns named `tag:<name>` (any case, optional spaces after the colon).
// A track has the tag when its URI is in that playlist. The tag's colour is the last `[#RRGGBB]` marker in
// the playlist description. Star ratings are the reserved tags `tag:1 Star` … `tag:5 Star`.
// Everything is keyed by playlist ID, never by name.

export const TAG_PREFIX = 'tag:'
export const DESCRIPTION_MAX = 300
export const RATING_COLOUR = '#F5C33B' // palette amber

export const PALETTE = [
  '#CC3D3D', // red
  '#F29130', // orange
  '#F5C33B', // amber
  '#A3CF4A', // lime
  '#278052', // green
  '#0E7F76', // teal
  '#5BC0EB', // sky
  '#2F6FD6', // blue
  '#7D4FC4', // violet
  '#C23D8F', // magenta
  '#F28AA6', // rose
  '#946349', // brown
]

// ── Names ────────────────────────────────────────────────────────────────────

/** The display name for a playlist name matching ^tag:\s*(.+)$ (ignoring case), trimmed, or null. */
export function tagDisplayName(playlistName) {
  if (typeof playlistName !== 'string') return null
  if (playlistName.slice(0, TAG_PREFIX.length).toLowerCase() !== TAG_PREFIX) return null
  const rest = playlistName.slice(TAG_PREFIX.length).trim()
  return rest || null
}

/** New and renamed tags are `tag:<name>`, no space after the colon. */
export const tagPlaylistName = (displayName) => TAG_PREFIX + displayName

/** "3 Star", "3 stars", "3star" (any case) → 3; anything else → null. */
export function ratingStars(displayName) {
  const lower = displayName.toLowerCase()
  const n = Number(lower[0])
  if (!(n >= 1 && n <= 5)) return null
  const rest = lower.slice(1).trim()
  return rest === 'star' || rest === 'stars' ? n : null
}

export const ratingName = (stars) => `${stars} Star`

/** Duplicate names are compared ignoring case. */
export const nameKey = (displayName) => displayName.toLowerCase()

// Built from a string: a raw U+2028 in a regex literal breaks the bundle
const LINE_BREAK_RE = new RegExp('[\\r\\n\\u0085\\u2028\\u2029]')

/** The rules for creating a tag. Returns { name } (trimmed) or { error }. */
export function validateTagName(input, existingNames) {
  const name = (input ?? '').trim()
  if (!name) return { error: 'Enter a name.' }
  if (LINE_BREAK_RE.test(name)) return { error: 'Names can’t contain line breaks.' }
  if (ratingStars(name) !== null) return { error: '“1 Star” to “5 Star” are reserved for ratings.' }
  if (existingNames.some(n => nameKey(n) === nameKey(name))) return { error: 'A tag with that name already exists.' }
  return { name }
}

// ── Descriptions & colour ────────────────────────────────────────────────────

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lsqb: '[', rsqb: ']', num: '#',
}
const ENTITY_RE = /&(#[xX][0-9A-Fa-f]{1,6}|#[0-9]{1,7}|[A-Za-z]{2,8});/g

function unescapeOnce(text) {
  return text.replace(ENTITY_RE, (whole, body) => {
    let code = null
    if (body[0] === '#') {
      code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) return whole
      return String.fromCodePoint(code)
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

/** Spotify returns descriptions HTML-escaped, sometimes twice. Decodes up to 3 rounds. */
export function unescapeHTML(text) {
  let current = text
  for (let i = 0; i < 3; i++) {
    const next = unescapeOnce(current)
    if (next === current) break
    current = next
  }
  return current
}

const MARKER_RE = /\[\s*#\s*([0-9A-Fa-f]{6})\s*\]/g

/** The colour in the last `[#RRGGBB]` marker, as uppercase `#RRGGBB`, or null. */
export function colourFromDescription(description) {
  if (!description) return null
  const matches = [...unescapeHTML(description).matchAll(MARKER_RE)]
  if (matches.length === 0) return null
  return '#' + matches[matches.length - 1][1].toUpperCase()
}

function fitWithMarker(text, colour) {
  const marker = ` [${colour.toUpperCase()}]`
  if (text.length + marker.length > DESCRIPTION_MAX) {
    text = text.slice(0, DESCRIPTION_MAX - marker.length - 1) + '…'
  }
  return text + marker
}

/** The standard description TrackTagger writes, with the colour marker last. */
export function tagDescription(displayName, colour) {
  return fitWithMarker(
    `A playlist representing a TrackTagger tag. This is a collection of songs tagged with ${displayName}.`,
    colour,
  )
}

/**
 * A description for a tag that has none or no marker: the standard one if it's empty, otherwise the
 * existing text with a marker appended, so the user's own text survives.
 */
export function descriptionWithMarker(existing, displayName, colour) {
  const text = existing ? unescapeHTML(existing).trim() : ''
  return text ? fitWithMarker(text, colour) : tagDescription(displayName, colour)
}

function useCounts(used) {
  const counts = new Map(PALETTE.map(c => [c, 0]))
  for (const c of used) if (counts.has(c)) counts.set(c, counts.get(c) + 1)
  return counts
}

/** First palette colour (in palette order) used least. Deterministic, so every client agrees. */
export function leastUsedColour(used) {
  const counts = useCounts(used)
  const fewest = Math.min(...counts.values())
  return PALETTE.find(c => counts.get(c) === fewest)
}

/** A random palette colour among those used least, for new tags. */
export function randomColour(used) {
  const counts = useCounts(used)
  const fewest = Math.min(...counts.values())
  const candidates = PALETTE.filter(c => counts.get(c) === fewest)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** Black text reads better on this colour than white (WCAG contrast). */
export function prefersDarkText(hex) {
  const rgb = parseInt(hex.slice(1), 16)
  const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const l = 0.2126 * lin((rgb >> 16) & 255) + 0.7152 * lin((rgb >> 8) & 255) + 0.0722 * lin(rgb & 255)
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05)
}

export const textColourOn = (hex) => (prefersDarkText(hex) ? '#000' : '#fff')

// ── Resolution ───────────────────────────────────────────────────────────────

/**
 * The tags in a /me/playlists listing: owned playlists with a tag name.
 * Returns { tags, ratings } where `tags` are ordinary tags (sorted by name) and `ratings` maps
 * 1–5 → the rating tag. For duplicate names (ignoring case) the first listed wins and is flagged.
 * Each tag: { id, name, rawName, colour, needsMarker, description, snapshot, hasDuplicate, stars }.
 */
export function resolveTags(playlists, userId) {
  const candidates = []
  for (const pl of playlists) {
    if (!pl || pl.owner?.id !== userId) continue
    const name = tagDisplayName(pl.name)
    if (!name) continue
    const marked = colourFromDescription(pl.description)
    candidates.push({
      id: pl.id,
      name,
      rawName: pl.name,
      colour: marked,
      needsMarker: marked === null,
      description: pl.description ?? '',
      snapshot: pl.snapshot_id,
      hasDuplicate: false,
      stars: ratingStars(name),
    })
  }

  const used = candidates.filter(t => !t.needsMarker).map(t => t.colour)
  for (const t of candidates) {
    if (t.needsMarker) {
      t.colour = leastUsedColour(used) // as TrackTagger does, so both apps pick the same
      used.push(t.colour)
    }
  }

  const byKey = new Map()
  for (const t of candidates) {
    const key = nameKey(t.name)
    if (byKey.has(key)) byKey.get(key).hasDuplicate = true
    else byKey.set(key, t)
  }

  const tags = []
  const ratings = {}
  for (const t of byKey.values()) {
    if (t.stars) {
      if (!ratings[t.stars]) ratings[t.stars] = t // a second "3 Star"-ish playlist is ignored
    } else {
      tags.push(t)
    }
  }
  tags.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
  return { tags, ratings }
}
