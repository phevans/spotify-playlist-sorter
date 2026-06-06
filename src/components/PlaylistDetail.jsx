import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { fetchAllPlaylistTracks, savePlaylistOrder, playTrack } from '../api.js'
import { fetchTrackKeys } from '../getsongbpm.js'
import { cacheGet, cacheSet, cacheClear } from '../cache.js'
import TrackRow from './TrackRow.jsx'
import styles from './PlaylistDetail.module.css'

const CYCLE_COLORS = [null, '#1db954', '#4a9eff', '#b44eff', '#ff8c42', '#ff4e6a']

// Pull all selected tracks out, then re-insert them as a group at the drop point.
function multiReorder(tracks, activeId, overId, selectedIds) {
  const activeIndex = tracks.findIndex(t => t.id === activeId)
  const overIndex = tracks.findIndex(t => t.id === overId)
  if (selectedIds.has(overId)) return arrayMove(tracks, activeIndex, overIndex)
  const selected = tracks.filter(t => selectedIds.has(t.id))
  const rest = tracks.filter(t => !selectedIds.has(t.id))
  const overInRest = rest.findIndex(t => t.id === overId)
  const insertAt = overIndex > activeIndex ? overInRest + 1 : overInRest
  return [...rest.slice(0, insertAt), ...selected, ...rest.slice(insertAt)]
}

export default function PlaylistDetail({ playlist, player }) {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [startOffset, setStartOffset] = useState(0)
  const [trackColors, setTrackColors] = useState({})
  const [keyMap, setKeyMap] = useState({})
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [activeDragId, setActiveDragId] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setTracks([])
    setHasChanges(false)
    setKeyMap({})
    setSelectedIds(new Set())

    fetchAllPlaylistTracks(playlist.id)
      .then(trackList => {
        setTracks(trackList)
        const savedColors = {}
        for (const track of trackList) {
          const c = cacheGet(`color:${track.id}`)
          if (c) savedColors[track.id] = c
        }
        setTrackColors(savedColors)
        setLoading(false)
        fetchTrackKeys(trackList, (trackId, key) => {
          setKeyMap(prev => ({ ...prev, [trackId]: key }))
        }).catch(() => {})
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [playlist.id])

  // Escape clears selection
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelectedIds(new Set()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragStart = useCallback(({ active }) => {
    setActiveDragId(active.id)
  }, [])

  const handleDragEnd = useCallback(({ active, over }) => {
    setActiveDragId(null)
    if (!over || active.id === over.id) return
    setTracks(prev => {
      if (selectedIds.has(active.id) && selectedIds.size > 1) {
        return multiReorder(prev, active.id, over.id, selectedIds)
      }
      const oldIndex = prev.findIndex(t => t.id === active.id)
      const newIndex = prev.findIndex(t => t.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
    setHasChanges(true)
  }, [selectedIds])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await savePlaylistOrder(playlist.id, tracks.map(t => t.uri))
      setHasChanges(false)
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }, [tracks, playlist.id])

  const handlePreview = useCallback(async (track) => {
    if (!player.deviceId) return
    if (player.currentTrackId === track.id) {
      player.togglePlay()
      return
    }
    try {
      await playTrack(player.deviceId, track.uri, startOffset * 1000)
    } catch (err) {
      setError(`Playback failed: ${err.message}`)
    }
  }, [player, startOffset])

  const handleColorClick = useCallback((trackId) => {
    setTrackColors(prev => {
      const current = prev[trackId] ?? null
      const idx = CYCLE_COLORS.indexOf(current)
      const next = CYCLE_COLORS[(idx + 1) % CYCLE_COLORS.length]
      next === null ? cacheClear(`color:${trackId}`) : cacheSet(`color:${trackId}`, next)
      return { ...prev, [trackId]: next }
    })
  }, [])

  const handleToggleSelect = useCallback((trackId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(trackId) ? next.delete(trackId) : next.add(trackId)
      return next
    })
  }, [])

  const coverImage = playlist.images?.[0]?.url
  const groupDragActive = activeDragId !== null && selectedIds.has(activeDragId) && selectedIds.size > 1
  const activeTrack = activeDragId ? tracks.find(t => t.id === activeDragId) ?? null : null
  const dragCount = groupDragActive ? selectedIds.size : 1

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        {coverImage && (
          <img className={styles.cover} src={coverImage} alt="" width={120} height={120} />
        )}
        <div className={styles.meta}>
          <p className={styles.label}>Playlist</p>
          <h1 className={styles.name}>{playlist.name}</h1>
          <p className={styles.info}>{playlist.tracks.total} tracks</p>
        </div>
      </div>

      <div className={styles.controls}>
        <label className={styles.offsetLabel}>
          Start at
          <input
            type="number"
            className={styles.offsetInput}
            min="0"
            step="5"
            value={startOffset}
            onChange={e => setStartOffset(Math.max(0, Number(e.target.value) || 0))}
          />
          s
        </label>
        {selectedIds.size > 0 && (
          <span className={styles.selectionCount}>
            {selectedIds.size} selected
            <button className={styles.clearSelection} onClick={() => setSelectedIds(new Set())}>×</button>
          </span>
        )}
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? 'Saving…' : 'Save to Spotify'}
        </button>
      </div>

      {player.playerError && (
        <div className={styles.playerError}>{player.playerError}</div>
      )}

      {error && (
        <div className={styles.saveError}>
          {error}
          <button className={styles.dismiss} onClick={() => setError(null)}>×</button>
        </div>
      )}

      {loading && <p className={styles.status}>Loading tracks…</p>}

      {!loading && tracks.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >

          <SortableContext
            items={tracks.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.trackList}>
              {tracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index}
                  isPlaying={player.currentTrackId === track.id && player.isPlaying}
                  isActive={player.currentTrackId === track.id}
                  onPreview={handlePreview}
                  player={player}
                  canPlay={!!player.deviceId && !player.playerError}
                  color={trackColors[track.id] ?? null}
                  onColorClick={handleColorClick}
                  openKey={keyMap[track.id] ?? null}
                  isSelected={selectedIds.has(track.id)}
                  isGroupActive={groupDragActive && selectedIds.has(track.id) && activeDragId !== track.id}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeTrack && <DragStack track={activeTrack} count={dragCount} />}
          </DragOverlay>
        </DndContext>
      )}

      {!loading && tracks.length > 0 && (
        <p className={styles.attribution}>
          Key data provided by <a href="https://getsongbpm.com" target="_blank" rel="noreferrer">GetSongBPM.com</a>
        </p>
      )}
    </div>
  )
}

function DragStack({ track, count }) {
  const extraCards = Math.min(count - 1, 2)
  return (
    <div className={styles.dragStack}>
      {Array.from({ length: extraCards }, (_, i) => {
        const offset = (extraCards - i) * 5
        return (
          <div
            key={i}
            className={styles.ghostCard}
            style={{
              transform: `translate(${offset}px, ${offset}px)`,
              opacity: 0.3 + i * 0.2,
              zIndex: i + 1,
            }}
          />
        )
      })}
      <div className={styles.activeCard}>
        <div className={styles.dragTrackInfo}>
          <span className={styles.dragTrackName}>{track.name}</span>
          <span className={styles.dragArtistName}>
            {track.artists.map(a => a.name).join(', ')}
          </span>
        </div>
        {count > 1 && <span className={styles.dragBadge}>{count}</span>}
      </div>
    </div>
  )
}
