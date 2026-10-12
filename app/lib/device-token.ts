// Device tokens: "<userId>.<hmac>". Stateless, so no extra table is needed.
// The browser asks for one (logged in), sends it to the ESP32 over BLE, and the
// ESP32 puts it in the Authorization header of /api/ingest.
// Changing DEVICE_TOKEN_SECRET revokes every token.

import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

function sign(userId: string) {
  const secret = process.env.DEVICE_TOKEN_SECRET
  if (!secret) throw new Error("DEVICE_TOKEN_SECRET is not set")
  return createHmac("sha256", secret).update(`device:${userId}`).digest("base64url")
}

export function createDeviceToken(userId: string) {
  return `${userId}.${sign(userId)}`
}

/** Returns the user id the token was issued for, or null. */
export function verifyDeviceToken(token: string): string | null {
  const [userId, sig] = token.split(".")
  if (!userId || !sig) return null
  const expected = Buffer.from(sign(userId))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null
}
