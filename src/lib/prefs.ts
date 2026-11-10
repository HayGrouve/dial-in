// The grinder and the Opus settings moved to `equipment` in Convex (src/lib/equipment.ts).
// The Gemini key stays on the device (#33).

const API_KEY = 'dial-in-gemini-key'

/** Gemini API key for reading bag labels. Stays on this device; never exported in backups. */
export function getApiKey() {
  return localStorage.getItem(API_KEY) ?? ''
}

export function setApiKey(key: string) {
  const v = key.trim()
  if (v) localStorage.setItem(API_KEY, v)
  else localStorage.removeItem(API_KEY)
}
