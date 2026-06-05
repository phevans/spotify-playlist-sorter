import { getAccessToken } from './auth.js'

async function apiFetch(path, options = {}) {
  const token = await getAccessToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Spotify API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function fetchCurrentUser() {
  return apiFetch('/me')
}

export async function fetchAllPlaylists() {
  const playlists = []
  let url = '/me/playlists?limit=50'
  while (url) {
    const data = await apiFetch(url)
    playlists.push(...data.items)
    url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null
  }
  return playlists
}

export async function fetchAllPlaylistTracks(playlistId) {
  const tracks = []
  const fields = 'next,items(track(id,uri,name,duration_ms,artists(name),album(name,images)))'
  let url = `/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(fields)}`
  while (url) {
    const data = await apiFetch(url)
    for (const item of data.items) {
      if (item.track && item.track.id) tracks.push(item.track)
    }
    url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null
  }
  return tracks
}

export async function fetchPlaylistSnapshot(playlistId) {
  const data = await apiFetch(`/playlists/${playlistId}?fields=snapshot_id`)
  return data.snapshot_id
}

export async function reorderPlaylistTracks(playlistId, rangeStart, insertBefore, snapshotId) {
  return apiFetch(`/playlists/${playlistId}/tracks`, {
    method: 'PUT',
    body: JSON.stringify({
      range_start: rangeStart,
      insert_before: insertBefore,
      range_length: 1,
      snapshot_id: snapshotId,
    }),
  })
}

export async function playTrack(deviceId, trackUri, positionMs = 0) {
  const body = { uris: [trackUri] }
  if (positionMs > 0) body.position_ms = positionMs
  return apiFetch(`/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function savePlaylistOrder(playlistId, uris) {
  // PUT replaces the playlist but is capped at 100; POST appends subsequent batches
  await apiFetch(`/playlists/${playlistId}/tracks`, {
    method: 'PUT',
    body: JSON.stringify({ uris: uris.slice(0, 100) }),
  })
  for (let i = 100; i < uris.length; i += 100) {
    await apiFetch(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    })
  }
}

export async function pausePlayback(deviceId) {
  return apiFetch(`/me/player/pause?device_id=${deviceId}`, { method: 'PUT' })
}

export async function seekPlayback(deviceId, positionMs) {
  return apiFetch(`/me/player/seek?device_id=${deviceId}&position_ms=${positionMs}`, {
    method: 'PUT',
  })
}
