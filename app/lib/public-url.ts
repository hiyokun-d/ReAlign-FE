// Other devices (the ESP32, a phone scanning a QR) can't reach "localhost": for
// them that's themselves. They need this computer's LAN address or the deployed URL.

export function isLocalhostUrl(url: string) {
  return /\/\/(localhost|127\.0\.0\.1)\b/.test(url)
}

/** This site's address as other devices would reach it, or "" when it's only localhost. */
export function defaultPublicOrigin() {
  const { origin } = window.location
  return isLocalhostUrl(origin) ? "" : origin
}
