import { startLogin } from '../auth.js'
import styles from './LoginPage.module.css'

// Deliberately not styled like Spotify's own sign-in page (no Spotify logo, no green pill
// button): Google Safe Browsing flagged the earlier look as a Spotify phishing page.
// Keep index.html's pre-render shell in sync with this text.
export default function LoginPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <SortIcon />
        <h1 className={styles.title}>Playlist Sorter</h1>
        <p className={styles.tagline}>A DJ tool for your Spotify playlists</p>
        <p className={styles.subtitle}>
          Drag tracks into any order, preview them, see their musical keys and tag them.
        </p>
        <p className={styles.note}>
          Track playback requires a Spotify Premium account. Browsing and reordering work for all accounts.
        </p>
        <button className={styles.btn} onClick={startLogin}>
          Continue to Spotify to sign in
        </button>
        <p className={styles.howItWorks}>
          You sign in on <strong>accounts.spotify.com</strong>, Spotify’s own site. This app never sees
          your password: Spotify only gives it permission to read and reorder your playlists and to
          control playback, which you can revoke at any time in your Spotify account settings.
        </p>
      </div>
      <p className={styles.attribution}>
        An independent tool, not affiliated with or endorsed by Spotify.
        {' '}Key data provided by <a href="https://getsongbpm.com" target="_blank" rel="noreferrer">GetSongBPM.com</a>
      </p>
    </div>
  )
}

function SortIcon() {
  return (
    <svg className={styles.logo} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h11M3 12h8M3 18h5" />
      <path d="M18 4v16M15 17l3 3 3-3" />
    </svg>
  )
}
