# Spotify Playlist Sorter

Drag-and-drop reordering for Spotify playlists, with full-track preview via the Web Playback SDK.

## Setup

### 1. Create a Spotify app

Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create a new app.

- Under **Redirect URIs**, add both:
  - `http://127.0.0.1:5173/callback` (local dev)
  - `https://sps.djgibbon.co.uk/callback` (production)
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
GETSONGBPM_KEY=your_getsongbpm_api_key
```

`GETSONGBPM_KEY` is optional — without it the app runs fine but the key column
stays blank (see [Musical keys](#musical-keys)). Note the missing `VITE_`
prefix: it is read server-side and must **not** reach the browser bundle.

### 3. Run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (not `localhost` — the origin must match the registered redirect URI exactly).

## Tags (shared with TrackTagger)

Tracks show the tags they have, read from your own playlists named `tag:<name>`.
This is the same format TrackTagger uses (see
`~/Code/spotify-track-tagger/docs/tag-format.md`), so tags added in either app show up in the other.
Click a track's tag area (or select tracks and click **Tags…**) to open the tag tiles: click a tile
to add or remove the tag, set a 1–5 star rating (the `tag:N Star` playlists), or create a new tag.

- A tag's colour is the `[#RRGGBB]` marker in the playlist description. Tags without a marker get
  one written to their description automatically, as TrackTagger does.
- Tag contents are cached in localStorage and only re-read when a playlist's `snapshot_id` changes.
  Syncs run on load, on returning to the tab (at most every 30 s), and via **Refresh** in the tag panel.
- The "Tag colour" dot and **Sort by colour** are separate, local-only features.

## Deployment

Deployed on Netlify at **https://sps.djgibbon.co.uk**.

The domain is registered at Namecheap and stays on Namecheap DNS (BasicDNS), so
the site is reached via a `CNAME` record — `sps` → `spotify-playlist-dj-tool.netlify.app`.
Nameservers are deliberately *not* delegated to Netlify, because the apex carries
Namecheap email-forwarding MX and SPF records.

The Netlify project (`spotify-playlist-dj-tool`) is linked to
`phevans/spotify-playlist-sorter` on GitHub: **every push to `main` builds and
deploys to production automatically**, using the build settings in `netlify.toml`.
Other branches and pull requests get preview deploys, but Spotify login won't work
on those URLs because they aren't registered redirect URIs.

A manual deploy from the CLI still works if needed:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

Environment variables live in the Netlify dashboard, not in the repo. Builds run
on Netlify, so the local `.env` isn't used for deploys: `VITE_SPOTIFY_CLIENT_ID`
and `VITE_REDIRECT_URI` must be set there, and `GETSONGBPM_KEY` is read at runtime
by the function. `VITE_*` values are baked in at **build** time, so changing one
requires a full rebuild and redeploy, not just a redeploy.

## Musical keys

Track keys are shown in [Open Key](https://en.wikipedia.org/wiki/Camelot_wheel)
notation (`8m`, `4d`, …) for harmonic mixing. Spotify's own `audio-features`
endpoint — the obvious source — was withdrawn for new apps in November 2024, so
keys come from [GetSongBPM](https://getsongbpm.com) instead, looked up by Spotify
track URI and cached in `localStorage` for 30 days.

Lookups are proxied through a Netlify function (`netlify/functions/songkey.mjs`,
exposed at `/api/songkey`). The API is CORS-open so the browser *could* call it
directly, but the key would then ship in the public bundle — and their terms
suspend accounts for abuse. The key stays server-side.

Two things about their API are easy to get wrong ([docs](https://getsongkey.com/api)):

- The base URL is **`api.getsong.co`**, not `api.getsongbpm.com`. The old host
  redirects into a Cloudflare challenge that never resolves for non-browser
  clients, so it fails with an opaque 403 rather than anything informative.
- There is **no Spotify ID lookup**. It's a title/artist text search
  (`type=both&lookup=song:… artist:…`), so keys are cached against the Spotify
  track id but queried by name. Spotify's title suffixes (`- 2011 Remaster`,
  `(feat. …)`) are stripped first, as they otherwise miss.

The response carries `open_key` in Open Key notation directly; `toOpenKey()` is
only a fallback for entries that have `key_of` but no `open_key`.

Requests are sequential to stay inside the documented 3000/hour limit, and
responses carry a long `s-maxage` so the CDN absorbs repeats.

Because of that, **`npm run dev` cannot resolve keys** — the function isn't
running. Use `npx netlify dev` instead, which serves the Vite app and the
function together and loads `GETSONGBPM_KEY` from `.env`.

Lookups fail soft: any missing key, failed request, or absent API key just leaves
the column blank rather than surfacing an error. A confirmed miss is cached for
30 days; an upstream failure is not, so it retries rather than sticking.

Attribution back to GetSongBPM.com is a condition of their free API, and is
rendered at the foot of the playlist view.

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
