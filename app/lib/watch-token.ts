// Signed watch links: "<userId>.<hmac>". Stateless, so no extra table is needed.
// The QR on /device carries one; anyone with the link can watch that user live (/watch).
// The live channel name (raw ~10 Hz samples) is derived the same way, so only the owner
// and people with a watch link know it.
// Changing DEVICE_TOKEN_SECRET revokes every link.

import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

type Purpose = "watch" | "live"

function sign(purpose: Purpose, userId: string) {
  const secret = process.env.DEVICE_TOKEN_SECRET
  if (!secret) throw new Error("DEVICE_TOKEN_SECRET is not set")
  return createHmac("sha256", secret).update(`${purpose}:${userId}`).digest("base64url")
}

export function createWatchToken(userId: string) {
  return `${userId}.${sign("watch", userId)}`
}

/** Returns the user id the link was made for, or null. */
export function verifyWatchToken(token: string): string | null {
  const [userId, sig] = token.split(".")
  if (!userId || !sig) return null
  const expected = Buffer.from(sign("watch", userId))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null
}

/** Supabase Realtime broadcast channel for one user's raw ~10 Hz samples (not stored). */
export const liveChannelFor = (userId: string) => `live-${sign("live", userId).slice(0, 32)}`
