import { useCallback, useEffect, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import PlaylistDetail from './PlaylistDetail.jsx'
import Player from './Player.jsx'
import TagToast from './TagToast.jsx'
import { useSpotifyPlayer } from '../useSpotifyPlayer.js'
import { useTags } from '../useTags.js'
import { playlistIdFromPath, playlistPath } from '../route.js'

const BASE_TITLE = 'Playlist Sorter for Spotify'
import styles from './MainLayout.module.css'

export default function MainLayout({ onLogout }) {
  const [selectedId, setSelectedId] = useState(() => playlistIdFromPath())
  const player = useSpotifyPlayer()
  const tags = useTags()

  const selectedPlaylist = selectedId ? tags.playlists.find(p => p.id === selectedId) ?? null : null
  const waitingForPlaylist = !!selectedId && !selectedPlaylist && tags.playlistsLoading

  const selectPlaylist = useCallback((pl) => {
    if (pl.id === selectedId) return
    window.history.pushState({}, '', playlistPath(pl.id))
    setSelectedId(pl.id)
  }, [selectedId])

  // Back/Forward
  useEffect(() => {
    const onPop = () => setSelectedId(playlistIdFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // A playlist in the URL that isn't in the user's list (deleted, unfollowed, mistyped)
  useEffect(() => {
    // Only once the list really loaded: a failed fetch shouldn't wipe the URL
    if (selectedId && !selectedPlaylist && !tags.playlistsLoading && !tags.playlistsError) {
      window.history.replaceState({}, '', '/')
      setSelectedId(null)
    }
  }, [selectedId, selectedPlaylist, tags.playlistsLoading, tags.playlistsError])

  useEffect(() => {
    document.title = selectedPlaylist ? `${selectedPlaylist.name} · ${BASE_TITLE}` : BASE_TITLE
  }, [selectedPlaylist])

  return (
    <div className={styles.layout}>
      <Sidebar
        playlists={tags.playlists}
        loading={tags.playlistsLoading}
        error={tags.playlistsError}
        selectedId={selectedId}
        onSelect={selectPlaylist}
        onLogout={onLogout}
      />
      <main className={styles.main}>
        {selectedPlaylist ? (
          <PlaylistDetail playlist={selectedPlaylist} player={player} tags={tags} />
        ) : (
          <EmptyState message={waitingForPlaylist ? 'Loading playlist…' : undefined} />
        )}
      </main>
      {player.deviceId && (
        <Player player={player} />
      )}
      <TagToast message={tags.message} onDismiss={tags.dismissMessage} raised={!!player.deviceId} />
    </div>
  )
}

function EmptyState({ message = 'Select a playlist to get started' }) {
  return (
    <div className={styles.empty}>
      <p>{message}</p>
    </div>
  )
}
