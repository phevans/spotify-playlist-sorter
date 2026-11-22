import { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import PlaylistDetail from './PlaylistDetail.jsx'
import Player from './Player.jsx'
import TagToast from './TagToast.jsx'
import { useSpotifyPlayer } from '../useSpotifyPlayer.js'
import { useTags } from '../useTags.js'
import styles from './MainLayout.module.css'

export default function MainLayout({ onLogout }) {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const player = useSpotifyPlayer()
  const tags = useTags()

  return (
    <div className={styles.layout}>
      <Sidebar
        playlists={tags.playlists}
        loading={tags.playlistsLoading}
        error={tags.playlistsError}
        selectedId={selectedPlaylist?.id}
        onSelect={setSelectedPlaylist}
        onLogout={onLogout}
      />
      <main className={styles.main}>
        {selectedPlaylist ? (
          <PlaylistDetail playlist={selectedPlaylist} player={player} tags={tags} />
        ) : (
          <EmptyState />
        )}
      </main>
      {player.deviceId && (
        <Player player={player} />
      )}
      <TagToast message={tags.message} onDismiss={tags.dismissMessage} raised={!!player.deviceId} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <p>Select a playlist to get started</p>
    </div>
  )
}
