import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchCurrentUser,
  fetchAllPlaylists,
  fetchPlaylistItemUris,
  addPlaylistItems,
  removePlaylistItems,
  createPlaylist,
  updatePlaylistDetails,
} from './api.js'
import { cacheGet, cacheSet, cacheClear } from './cache.js'
import {
  resolveTags,
  validateTagName,
  tagPlaylistName,
  tagDescription,
  descriptionWithMarker,
  randomColour,
  ratingName,
  ratingStars,
  RATING_COLOUR,
} from './tags.js'

const RESYNC_MIN_MS = 30_000
const CONCURRENCY = 4
const BATCH = 100
const IDX_IDS = 'tagidx:ids'
const idxKey = (id) => `tagidx:${id}`

const sortTags = (tags) =>
  [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))

function describeError(err) {
  const msg = String(err?.message ?? err)
  if (err instanceof TypeError) return 'Couldn’t reach Spotify.'
  if (msg.includes(' 401')) return 'Your Spotify session expired. Log in again.'
  if (msg.includes(' 403')) return 'Spotify refused the change.'
  if (msg.includes(' 404')) return 'That playlist no longer exists.'
  if (msg.includes(' 429')) return 'Spotify is rate-limiting requests. Try again shortly.'
  return 'Spotify returned an error.'
}

async function pool(items, size, fn) {
  let next = 0
  const lane = async () => { while (next < items.length) await fn(items[next++]) }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane))
}

/** Loads the cached index: playlist ID → { snapshot, uris }. */
function loadIndex() {
  const confirmed = {}
  const indexed = {}
  for (const id of cacheGet(IDX_IDS) ?? []) {
    const entry = cacheGet(idxKey(id))
    if (entry && Array.isArray(entry.u)) {
      confirmed[id] = new Set(entry.u)
      indexed[id] = entry.s
    }
  }
  return { confirmed, indexed }
}

/**
 * The user's playlists plus the TrackTagger tags among them (see src/tags.js).
 *
 * Membership comes from the playlists' actual contents, cached in localStorage and only re-read when a
 * playlist's snapshot_id changes, so tags written by TrackTagger (or in Spotify) show up on the next sync.
 * Syncs run on mount, on returning to the tab (at most every 30 s) and on refresh().
 *
 * Writes are optimistic. Each playlist has one writer at a time; toggles made while a request is in flight
 * are coalesced, so only the last wanted state per track is sent, and a URI is never added twice.
 */
export function useTags() {
  const [playlists, setPlaylists] = useState([])
  const [playlistsLoading, setPlaylistsLoading] = useState(true)
  const [playlistsError, setPlaylistsError] = useState(null)
  const [tags, setTags] = useState([])
  const [ratings, setRatings] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [message, setMessage] = useState(null)
  const [creatingRating, setCreatingRating] = useState(null)

  // Server-confirmed contents, and the snapshot they correspond to
  const confirmed = useRef(null)
  const indexed = useRef(null)
  if (confirmed.current === null) {
    const idx = loadIndex()
    confirmed.current = idx.confirmed
    indexed.current = idx.indexed
  }
  // Displayed contents: confirmed plus pending toggles
  const [membership, setMembership] = useState(() => ({ ...confirmed.current }))

  const desired = useRef({})        // playlist ID → Map<uri, wanted>
  const working = useRef(new Set()) // playlist IDs with a writer running
  const writeGen = useRef({})       // playlist ID → writes started, so a stale read can be discarded
  const markerWritten = useRef(new Set())
  const latest = useRef({ tags: [], ratings: {} })
  const userId = useRef(null)
  const syncRun = useRef(null)
  const lastSync = useRef(0)

  const showMessage = useCallback((text) => {
    setMessage({ id: Date.now() + Math.random(), text })
  }, [])

  const dismissMessage = useCallback((id) => {
    setMessage(m => (m && m.id === id ? null : m))
  }, [])

  const publish = useCallback((pid) => {
    const base = confirmed.current[pid]
    if (!base) {
      setMembership(m => {
        if (!(pid in m)) return m
        const rest = { ...m }
        delete rest[pid]
        return rest
      })
      return
    }
    const shown = new Set(base)
    const pending = desired.current[pid]
    if (pending) for (const [uri, want] of pending) want ? shown.add(uri) : shown.delete(uri)
    setMembership(m => ({ ...m, [pid]: shown }))
  }, [])

  const persist = useCallback((pid) => {
    cacheSet(idxKey(pid), { s: indexed.current[pid], u: [...confirmed.current[pid]] })
  }, [])

  const persistIds = useCallback(() => {
    cacheSet(IDX_IDS, Object.keys(confirmed.current))
  }, [])

  const tagName = (pid) => {
    const { tags, ratings } = latest.current
    return [...tags, ...Object.values(ratings)].find(t => t.id === pid)?.name ?? 'tag'
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  const runWriter = useCallback(async (pid) => {
    if (working.current.has(pid)) return
    working.current.add(pid)
    try {
      for (;;) {
        const pending = desired.current[pid]
        const have = confirmed.current[pid]
        if (!pending || !have) break
        const adds = []
        const removes = []
        for (const [uri, want] of pending) {
          if (want && !have.has(uri)) adds.push(uri)
          else if (!want && have.has(uri)) removes.push(uri)
          else pending.delete(uri) // already as wanted
        }
        if (adds.length === 0 && removes.length === 0) break

        const addBatch = adds.slice(0, BATCH)
        const removeBatch = adds.length ? [] : removes.slice(0, BATCH)
        writeGen.current[pid] = (writeGen.current[pid] ?? 0) + 1
        try {
          let snapshot
          if (addBatch.length) {
            snapshot = await addPlaylistItems(pid, addBatch)
            addBatch.forEach(uri => have.add(uri))
          } else {
            snapshot = await removePlaylistItems(pid, removeBatch)
            removeBatch.forEach(uri => have.delete(uri))
          }
          // Our own write: remember its snapshot so the next sync doesn't re-read the playlist
          if (snapshot) indexed.current[pid] = snapshot
          persist(pid)
        } catch (err) {
          // Revert what this request tried, unless the user has since asked for something else
          const wanted = addBatch.length > 0
          for (const uri of addBatch.length ? addBatch : removeBatch) {
            if (pending.get(uri) === wanted) pending.delete(uri)
          }
          showMessage(`Couldn’t update “${tagName(pid)}”. ${describeError(err)}`)
        }
        publish(pid)
      }
    } finally {
      working.current.delete(pid)
    }
  }, [persist, publish, showMessage])

  /** Adds (on) or removes (off) each URI to/from a tag. Ignored until the tag's contents are loaded. */
  const setTagged = useCallback((pid, uris, on) => {
    if (!confirmed.current[pid] || uris.length === 0) return
    const pending = desired.current[pid] ?? (desired.current[pid] = new Map())
    for (const uri of uris) pending.set(uri, on)
    publish(pid)
    runWriter(pid)
  }, [publish, runWriter])

  const createTagPlaylist = useCallback(async (name, colour) => {
    const pl = await createPlaylist({ name: tagPlaylistName(name), description: tagDescription(name, colour) })
    // `public: false` on create isn't always honoured right away; send it once more (best effort)
    updatePlaylistDetails(pl.id, { public: false }).catch(() => {})
    const tag = {
      id: pl.id,
      name,
      rawName: pl.name,
      colour,
      needsMarker: false,
      description: pl.description ?? '',
      snapshot: pl.snapshot_id,
      hasDuplicate: false,
      stars: ratingStars(name),
    }
    confirmed.current[pl.id] = new Set()
    indexed.current[pl.id] = pl.snapshot_id
    persist(pl.id)
    persistIds()
    publish(pl.id)

    const { tags, ratings } = latest.current
    if (tag.stars) {
      latest.current = { tags, ratings: { ...ratings, [tag.stars]: tag } }
      setRatings(latest.current.ratings)
    } else {
      latest.current = { tags: sortTags([...tags, tag]), ratings }
      setTags(latest.current.tags)
    }
    setPlaylists(prev => [...prev, pl])
    return tag
  }, [persist, persistIds, publish])

  /** Creates a new tag. Resolves { tag } or { error }. */
  const createTag = useCallback(async (input) => {
    const { tags, ratings } = latest.current
    const result = validateTagName(input, [...tags, ...Object.values(ratings)].map(t => t.name))
    if (result.error) return { error: result.error }
    try {
      return { tag: await createTagPlaylist(result.name, randomColour(tags.map(t => t.colour))) }
    } catch (err) {
      return { error: `Couldn’t create the tag. ${describeError(err)}` }
    }
  }, [createTagPlaylist])

  /** Rates each URI 1–5, or clears its rating (null). An item is in at most one rating tag. */
  const setRating = useCallback(async (uris, stars) => {
    if (uris.length === 0) return
    const { ratings } = latest.current
    for (let n = 1; n <= 5; n++) {
      if (ratings[n]) setTagged(ratings[n].id, uris, n === stars)
    }
    if (!stars || ratings[stars]) return
    setCreatingRating(stars)
    try {
      const tag = await createTagPlaylist(ratingName(stars), RATING_COLOUR)
      setTagged(tag.id, uris, true)
    } catch (err) {
      showMessage(`Couldn’t save the rating. ${describeError(err)}`)
    } finally {
      setCreatingRating(null)
    }
  }, [setTagged, createTagPlaylist, showMessage])

  // ── Sync ───────────────────────────────────────────────────────────────────

  const sync = useCallback(() => {
    if (syncRun.current) return syncRun.current
    const run = (async () => {
      setSyncing(true)
      try {
        if (!userId.current) userId.current = (await fetchCurrentUser()).id
        const list = await fetchAllPlaylists()
        setPlaylists(list)
        setPlaylistsError(null)

        const { tags, ratings } = resolveTags(list, userId.current)
        latest.current = { tags, ratings }
        setTags(tags)
        setRatings(ratings)
        const all = [...tags, ...Object.values(ratings)]

        // Forget playlists that are gone or no longer tags
        const present = new Set(all.map(t => t.id))
        for (const pid of Object.keys(confirmed.current)) {
          if (present.has(pid) || working.current.has(pid)) continue
          delete confirmed.current[pid]
          delete indexed.current[pid]
          delete desired.current[pid]
          cacheClear(idxKey(pid))
          publish(pid)
        }
        persistIds()

        // Tags without a colour marker get the one we picked written back, once per session
        for (const t of all) {
          if (!t.needsMarker || markerWritten.current.has(t.id)) continue
          markerWritten.current.add(t.id)
          updatePlaylistDetails(t.id, { description: descriptionWithMarker(t.description, t.name, t.colour) })
            .catch(() => {})
        }

        const stale = all.filter(t => !confirmed.current[t.id] || indexed.current[t.id] !== t.snapshot)
        let done = 0
        let failed = 0
        if (stale.length) setProgress({ done, total: stale.length })
        await pool(stale, CONCURRENCY, async (t) => {
          // While writing, skip: the next sync sees the snapshot differ and re-reads it then
          if (!working.current.has(t.id)) {
            const gen = writeGen.current[t.id] ?? 0
            try {
              const uris = await fetchPlaylistItemUris(t.id)
              if ((writeGen.current[t.id] ?? 0) === gen && !working.current.has(t.id)) {
                confirmed.current[t.id] = new Set(uris)
                indexed.current[t.id] = t.snapshot
                persist(t.id)
                publish(t.id)
              }
            } catch {
              failed++
            }
          }
          setProgress({ done: ++done, total: stale.length })
        })
        persistIds()
        if (failed) showMessage(`Couldn’t load ${failed} tag${failed === 1 ? '' : 's'}. Try refreshing.`)
      } catch (err) {
        setPlaylistsError(err.message)
      } finally {
        lastSync.current = Date.now()
        syncRun.current = null
        setSyncing(false)
        setProgress(null)
        setPlaylistsLoading(false)
      }
    })()
    syncRun.current = run
    return run
  }, [persist, persistIds, publish, showMessage])

  useEffect(() => {
    sync()
    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSync.current > RESYNC_MIN_MS) sync()
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [sync])

  // ── Lookups ────────────────────────────────────────────────────────────────

  const tagsByUri = useMemo(() => {
    const map = new Map()
    for (const t of tags) {
      const set = membership[t.id]
      if (!set) continue
      for (const uri of set) {
        const list = map.get(uri)
        list ? list.push(t) : map.set(uri, [t])
      }
    }
    return map
  }, [tags, membership])

  const ratingByUri = useMemo(() => {
    const map = new Map()
    for (let n = 1; n <= 5; n++) {
      const set = ratings[n] && membership[ratings[n].id]
      if (set) for (const uri of set) map.set(uri, n) // ascending, so the highest wins
    }
    return map
  }, [ratings, membership])

  const ratingsLoaded = [1, 2, 3, 4, 5].every(n => !ratings[n] || membership[ratings[n].id])

  return {
    playlists,
    playlistsLoading,
    playlistsError,
    tags,
    ratings,
    membership,
    syncing,
    progress,
    message,
    dismissMessage,
    creatingRating,
    ratingsLoaded,
    isLoaded: (pid) => !!membership[pid],
    has: (pid, uri) => !!membership[pid]?.has(uri),
    tagsFor: (uri) => tagsByUri.get(uri) ?? [],
    ratingFor: (uri) => ratingByUri.get(uri) ?? null,
    setTagged,
    setRating,
    createTag,
    refresh: sync,
  }
}
