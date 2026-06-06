import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './TrackRow.module.css'

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' fill='%23333'/%3E%3Ccircle cx='24' cy='24' r='10' fill='none' stroke='%23666' stroke-width='2'/%3E%3Ccircle cx='24' cy='24' r='3' fill='%23666'/%3E%3C/svg%3E"

function formatDuration(ms) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function smallAlbumImage(images) {
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => (a.width || 999) - (b.width || 999))
  return sorted.find(img => img.url)?.url ?? null
}

export default function TrackRow({ track, index, isPlaying, isActive, onPreview, player, canPlay, color, onColorClick, openKey, isSelected, isGroupActive, onToggleSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.id })

  const handleRowClick = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && !isDragging) {
      e.preventDefault()
      onToggleSelect(track.id)
    }
  }, [track.id, isDragging, onToggleSelect])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: (isDragging || isGroupActive) ? 0 : 1,
  }

  const albumArt = smallAlbumImage(track.album?.images)

  const handleSeek = (e) => {
    if (!isActive || !player.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    player.seek(Math.round(fraction * player.duration))
  }

  const progressFraction = isActive && player.duration
    ? Math.min(player.position / player.duration, 1)
    : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleRowClick}
      className={[
        styles.row,
        isActive     ? styles.active      : '',
        isDragging   ? styles.dragging    : '',
        isSelected   ? styles.selected    : '',
        isGroupActive ? styles.groupActive : '',
      ].join(' ')}
    >
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <DragIcon />
      </span>

      <span className={styles.index}>{index + 1}</span>

      <button
        className={`${styles.previewBtn} ${isPlaying ? styles.playing : ''}`}
        onClick={() => onPreview(track)}
        title={canPlay ? (isPlaying ? 'Pause' : 'Play preview') : 'Premium required'}
        disabled={!canPlay && !isActive}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <img
        className={styles.albumArt}
        src={albumArt || PLACEHOLDER}
        alt=""
        width={40}
        height={40}
      />

      <div className={styles.trackInfo}>
        <span className={styles.trackName}>{track.name}</span>
        <span className={styles.artists}>
          {track.artists.map(a => a.name).join(', ')}
          {track.album?.name && ` · ${track.album.name}`}
        </span>

        {isActive && (
          <div
            className={styles.timeline}
            onClick={handleSeek}
            title="Click to seek"
          >
            <div className={styles.timelineTrack}>
              <div
                className={styles.timelineFill}
                style={{ width: `${progressFraction * 100}%` }}
              />
              <div
                className={styles.timelineThumb}
                style={{ left: `${progressFraction * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <span className={styles.duration}>{formatDuration(track.duration_ms)}</span>

      <span className={`${styles.openKey} ${openKey ? (openKey.endsWith('d') ? styles.major : styles.minor) : styles.keyEmpty}`}>
        {openKey ?? '—'}
      </span>

      <button
        className={styles.colorDot}
        style={color ? { background: color, borderColor: color } : {}}
        onClick={() => onColorClick(track.id)}
        title="Tag colour"
      />
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  )
}

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
      <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
    </svg>
  )
}
