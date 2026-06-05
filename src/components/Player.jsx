import styles from './Player.module.css'

function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export default function Player({ player }) {
  const { isPlaying, duration, position, togglePlay, seek, currentTrackId } = player

  if (!currentTrackId) return null

  const fraction = duration ? Math.min(position / duration, 1) : 0

  const handleBarClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - rect.left) / rect.width
    seek(Math.round(f * duration))
  }

  return (
    <div className={styles.bar}>
      <button
        className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <span className={styles.time}>{formatTime(position)}</span>

      <div className={styles.progress} onClick={handleBarClick}>
        <div className={styles.fill} style={{ width: `${fraction * 100}%` }} />
        <div className={styles.thumb} style={{ left: `${fraction * 100}%` }} />
      </div>

      <span className={styles.time}>{formatTime(duration)}</span>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  )
}
