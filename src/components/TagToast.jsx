import { useEffect } from 'react'
import styles from './TagToast.module.css'

const DURATION_MS = 4000

/** A short message about a tag write that failed. Goes away by itself; click to dismiss. */
export default function TagToast({ message, onDismiss, raised }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => onDismiss(message.id), DURATION_MS)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  if (!message) return null
  return (
    <div
      className={`${styles.toast} ${raised ? styles.raised : ''}`}
      role="status"
      onClick={() => onDismiss(message.id)}
    >
      {message.text}
    </div>
  )
}
