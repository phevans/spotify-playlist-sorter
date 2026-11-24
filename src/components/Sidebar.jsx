import { useEffect, useRef } from 'react'
import styles from './Sidebar.module.css'

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23333'/%3E%3Cpath d='M32 20c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 20c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm0-12c-2.209 0-4 1.791-4 4s1.791 4 4 4 4-1.791 4-4-1.791-4-4-4z' fill='%23666'/%3E%3C/svg%3E"

export default function Sidebar({ playlists, loading, error, selectedId, onSelect, onLogout }) {
  const listRef = useRef(null)

  // Bring the selected playlist into view, e.g. one opened from the URL far down the list
  useEffect(() => {
    if (loading || !selectedId) return
    listRef.current?.querySelector(`[data-playlist-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [loading, selectedId])

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>Your Playlists</span>
        <button className={styles.logout} onClick={onLogout} title="Log out">
          <LogoutIcon />
        </button>
      </div>
      <div className={styles.list} ref={listRef}>
        {loading && <p className={styles.status}>Loading playlists…</p>}
        {error && playlists.length === 0 && <p className={styles.error}>{error}</p>}
        {!loading && playlists.map(pl => (
          <button
            key={pl.id}
            data-playlist-id={pl.id}
            className={`${styles.item} ${pl.id === selectedId ? styles.active : ''}`}
            onClick={() => onSelect(pl)}
          >
            <img
              className={styles.thumb}
              src={smallImage(pl.images) || PLACEHOLDER}
              alt=""
              width={40}
              height={40}
            />
            <div className={styles.info}>
              <span className={styles.name}>{pl.name}</span>
              <span className={styles.count}>{trackCount(pl)} tracks</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}

function trackCount(pl) {
  return (pl.tracks ?? pl.items)?.total ?? 0
}

function smallImage(images) {
  if (!images || images.length === 0) return null
  // Prefer the smallest entry (usually last), but any non-null url works
  const sorted = [...images].sort((a, b) => (a.width || 999) - (b.width || 999))
  return sorted.find(img => img.url)?.url ?? null
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
