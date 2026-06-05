# Spotify Playlist Sorter

Drag-and-drop reordering for Spotify playlists, with full-track preview via the Web Playback SDK.

## Setup

### 1. Create a Spotify app

Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create a new app.

- Under **Redirect URIs**, add: `http://127.0.0.1:5173/callback`
- Under **APIs used**, tick **Web API** and **Web Playback SDK**
- Save the app and copy the **Client ID**

### 2. Configure the environment

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_REDIRECT_URI=http://127.0.0.1:5173/callback
```

### 3. Run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (not `localhost` — the origin must match the registered redirect URI exactly).

## Notes

- **Track playback requires Spotify Premium.** The Web Playback SDK only works for Premium subscribers. Free accounts can still log in, browse playlists, and reorder tracks — they just can't preview audio.
- The app is entirely browser-side. There is no server or client secret.
- The `preview_url` field (30-second clips) is not used, as Spotify stopped exposing it to new apps in November 2024.

## Features

- Browse all your playlists with cover thumbnails
- Open a playlist and see all tracks with album art
- Drag tracks to reorder — saved immediately
- Click a track's play button to start full playback (Premium)
- Click the timeline in a track row or the bottom bar to seek
- Smooth interpolated progress bar between SDK state updates
- Graceful error messages for non-Premium accounts
