export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // crypto.randomUUID requires a secure context (HTTPS or localhost) — accessing
  // the dev server over plain HTTP via a LAN/Tailscale hostname doesn't qualify.
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
