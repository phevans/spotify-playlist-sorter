const NS = 'spls:'

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(NS + key)
    if (raw === null) return undefined
    const { v, exp } = JSON.parse(raw)
    if (exp !== null && Date.now() > exp) {
      localStorage.removeItem(NS + key)
      return undefined
    }
    return v
  } catch {
    return undefined
  }
}

export function cacheSet(key, value, ttlMs = null) {
  try {
    localStorage.setItem(NS + key, JSON.stringify({
      v: value,
      exp: ttlMs ? Date.now() + ttlMs : null,
    }))
  } catch {
    // Quota exceeded or storage unavailable — silent fail
  }
}

export function cacheClear(key) {
  try {
    localStorage.removeItem(NS + key)
  } catch { /* empty */ }
}
