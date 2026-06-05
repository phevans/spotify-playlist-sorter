import { useEffect, useRef, useState, useCallback } from 'react'
import { getAccessToken } from './auth.js'

export function useSpotifyPlayer() {
  const playerRef = useRef(null)
  const [deviceId, setDeviceId] = useState(null)
  const [playerState, setPlayerState] = useState(null)
  // { position_ms, timestamp } — interpolated between SDK state updates
  const [interpolated, setInterpolated] = useState({ position_ms: 0, timestamp: Date.now() })
  const [playerError, setPlayerError] = useState(null)
  const [isPremium, setIsPremium] = useState(null) // null = unknown

  useEffect(() => {
    if (!window.Spotify) {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.head.appendChild(script)
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Playlist Sorter',
        getOAuthToken: async (cb) => {
          const token = await getAccessToken()
          cb(token)
        },
        volume: 0.8,
      })

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id)
        setPlayerError(null)
      })

      player.addListener('not_ready', () => {
        setDeviceId(null)
      })

      player.addListener('player_state_changed', (state) => {
        if (!state) return
        setPlayerState(state)
        setInterpolated({ position_ms: state.position, timestamp: Date.now() })
      })

      player.addListener('authentication_error', ({ message }) => {
        setPlayerError(`Authentication error: ${message}`)
        setIsPremium(false)
      })

      player.addListener('account_error', ({ message }) => {
        setPlayerError(`Spotify Premium is required for playback. (${message})`)
        setIsPremium(false)
      })

      player.addListener('playback_error', ({ message }) => {
        setPlayerError(`Playback error: ${message}`)
      })

      player.connect()
      playerRef.current = player
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
      }
    }
  }, [])

  // Interpolate progress between SDK state pushes so the bar moves smoothly
  useEffect(() => {
    if (!playerState || playerState.paused) return

    const interval = setInterval(() => {
      setInterpolated(prev => ({
        position_ms: prev.position_ms + 250,
        timestamp: prev.timestamp + 250,
      }))
    }, 250)

    return () => clearInterval(interval)
  }, [playerState])

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay()
  }, [])

  const seek = useCallback((positionMs) => {
    playerRef.current?.seek(positionMs)
    setInterpolated({ position_ms: positionMs, timestamp: Date.now() })
  }, [])

  const currentTrackId = playerState?.track_window?.current_track?.id ?? null
  const isPlaying = playerState ? !playerState.paused : false
  const duration = playerState?.track_window?.current_track?.duration_ms ?? 0

  return {
    deviceId,
    playerError,
    isPremium,
    currentTrackId,
    isPlaying,
    duration,
    position: interpolated.position_ms,
    togglePlay,
    seek,
  }
}
