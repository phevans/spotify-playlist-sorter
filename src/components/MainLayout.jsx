import { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import PlaylistDetail from './PlaylistDetail.jsx'
import Player from './Player.jsx'
import { useSpotifyPlayer } from '../useSpotifyPlayer.js'
import styles from './MainLayout.module.css'

export default function MainLayout({ onLogout }) {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const player = useSpotifyPlayer()

  return (
    <div className={styles.layout}>
      <Sidebar
        selectedId={selectedPlaylist?.id}
        onSelect={setSelectedPlaylist}
        onLogout={onLogout}
      />
      <main className={styles.main}>
        {selectedPlaylist ? (
          <PlaylistDetail playlist={selectedPlaylist} player={player} />
        ) : (
          <EmptyState />
        )}
      </main>
      {player.deviceId && (
        <Player player={player} />
      )}
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
