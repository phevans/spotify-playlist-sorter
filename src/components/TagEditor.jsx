import { useEffect, useRef, useState } from 'react'
import { textColourOn } from '../tags.js'
import styles from './TagEditor.module.css'

/**
 * Tag tiles for one or more tracks, TrackTagger-style: every `tag:` playlist is a tile, lit when the
 * track is in it. With several tracks a tile is lit if all have the tag, part-lit if some do; clicking a
 * part-lit or unlit tile adds the tag to all of them, clicking a lit one removes it from all.
 */
export default function TagEditor({ tags, tracks, onClose, playerVisible = false }) {
  const uris = tracks.map(t => t.uri)
  const panelRef = useRef(null)

  useEffect(() => {
    // Capture phase, so Escape closes this without also clearing the track selection
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (e.target?.dataset?.newTagInput !== undefined) return // the input cancels itself
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => { panelRef.current?.focus() }, [])

  const title = tracks.length === 1 ? tracks[0].name : `${tracks.length} tracks`
  const subtitle = tracks.length === 1
    ? tracks[0].artists.map(a => a.name).join(', ')
    : tracks.slice(0, 3).map(t => t.name).join(', ') + (tracks.length > 3 ? '…' : '')

  return (
    // The backdrop stops at the player bar, so it stays usable (seek, skip) while tagging
    <div
      className={`${styles.backdrop} ${playerVisible ? styles.abovePlayer : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.panel} ref={panelRef} tabIndex={-1} role="dialog" aria-label="Edit tags">
        <div className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.label}>Tags</span>
            <span className={styles.title}>{title}</span>
            <span className={styles.subtitle}>{subtitle}</span>
          </div>
          <button className={styles.close} onClick={onClose} title="Close (Esc)" aria-label="Close">×</button>
        </div>

        <StarRow tags={tags} uris={uris} />

        <div className={styles.grid}>
          {tags.tags.map(tag => (
            <TagTile key={tag.id} tag={tag} tags={tags} uris={uris} />
          ))}
          <NewTagTile tags={tags} uris={uris} />
        </div>

        {tags.tags.length === 0 && !tags.syncing && (
          <p className={styles.empty}>
            No tags yet. Tags are your playlists named <code>tag:something</code>. Create one with ＋ New tag.
          </p>
        )}

        <div className={styles.footer}>
          <span>
            {tags.progress
              ? `Loading tags… ${tags.progress.done}/${tags.progress.total}`
              : tags.syncing ? 'Syncing…' : 'Shared with TrackTagger via your tag: playlists'}
          </span>
          <button className={styles.refresh} onClick={tags.refresh} disabled={tags.syncing}>Refresh</button>
        </div>
      </div>
    </div>
  )
}

function TagTile({ tag, tags, uris }) {
  const loaded = tags.isLoaded(tag.id)
  const count = loaded ? uris.filter(uri => tags.has(tag.id, uri)).length : 0
  const state = !loaded ? 'loading' : count === 0 ? 'off' : count === uris.length ? 'on' : 'some'
  const lit = state === 'on'

  const toggle = () => {
    if (!loaded) return
    tags.setTagged(tag.id, uris, !lit)
  }

  const style = {
    '--tag': tag.colour,
    '--tag-text': textColourOn(tag.colour),
  }

  return (
    <button
      className={`${styles.tile} ${styles[state]}`}
      style={style}
      onClick={toggle}
      disabled={!loaded}
      aria-pressed={state === 'some' ? 'mixed' : lit}
      title={state === 'some' ? `${count} of ${uris.length} tracks have this tag` : tag.rawName}
    >
      {lit && <span className={styles.check} aria-hidden="true">✓</span>}
      {state === 'some' && <span className={styles.check} aria-hidden="true">–</span>}
      <span className={styles.tileName}>{tag.name}</span>
      {state === 'loading' && <span className={styles.spinner} aria-label="loading" />}
      {tag.hasDuplicate && (
        <span
          className={styles.duplicate}
          title={`More than one playlist is called “tag:${tag.name}”. Only this one is used; rename or delete the others in Spotify.`}
        >⚠</span>
      )}
    </button>
  )
}

function NewTagTile({ tags, uris }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const cancel = () => { setEditing(false); setName(''); setError(null) }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await tags.createTag(name)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    tags.setTagged(result.tag.id, uris, true)
    cancel()
  }

  if (!editing) {
    return (
      <button className={`${styles.tile} ${styles.newTile}`} onClick={() => setEditing(true)}>
        ＋ New tag
      </button>
    )
  }

  return (
    <form className={`${styles.tile} ${styles.newForm}`} onSubmit={submit}>
      <input
        className={styles.newInput}
        data-new-tag-input=""
        autoFocus
        value={name}
        placeholder="Tag name"
        maxLength={100}
        disabled={busy}
        onChange={e => { setName(e.target.value); setError(null) }}
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          e.nativeEvent.stopPropagation() // don't let it reach the selection-clearing listener
          cancel()
        }}
        onBlur={() => { if (!name.trim() && !busy) cancel() }}
      />
      {error && <span className={styles.newError}>{error}</span>}
    </form>
  )
}

function StarRow({ tags, uris }) {
  const [hover, setHover] = useState(null)
  const ratings = uris.map(uri => tags.ratingFor(uri))
  const shared = ratings.every(r => r === ratings[0]) ? ratings[0] : undefined // undefined = mixed
  const enabled = tags.ratingsLoaded && tags.creatingRating === null
  const shown = hover ?? tags.creatingRating ?? shared ?? 0

  return (
    <div className={styles.stars} onMouseLeave={() => setHover(null)}>
      <span className={styles.starsLabel}>Rating</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          className={`${styles.star} ${n <= shown ? styles.starOn : ''}`}
          disabled={!enabled}
          onMouseEnter={() => setHover(n)}
          onClick={() => tags.setRating(uris, shared === n ? null : n)}
          title={shared === n ? 'Clear rating' : `${n} star${n === 1 ? '' : 's'}`}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-pressed={shared === n}
        >★</button>
      ))}
      {shared === undefined && <span className={styles.starsNote}>mixed</span>}
      {shared > 0 && (
        <button className={styles.clearRating} disabled={!enabled} onClick={() => tags.setRating(uris, null)}>
          Clear
        </button>
      )}
    </div>
  )
}
