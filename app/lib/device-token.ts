// Signed tokens: "<userId>.<hmac>". Stateless, so no extra table is needed.
//   device: the browser sends it to the ESP32 over BLE; the ESP32 uploads to /api/ingest with it.
//   watch:  goes in the QR code; anyone with the link can watch that user's live readings (/watch).
//   live:   not a token, a Realtime broadcast channel name only the owner and watch links know.
// The purpose is part of the signature, so a watch link can't be used to upload and vice versa.
// Changing DEVICE_TOKEN_SECRET revokes every token.

import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

type Purpose = "device" | "watch" | "live"

function sign(purpose: Purpose, userId: string) {
  const secret = process.env.DEVICE_TOKEN_SECRET
  if (!secret) throw new Error("DEVICE_TOKEN_SECRET is not set")
  return createHmac("sha256", secret).update(`${purpose}:${userId}`).digest("base64url")
}

function create(purpose: Purpose, userId: string) {
  return `${userId}.${sign(purpose, userId)}`
}

/** Returns the user id the token was issued for, or null. */
function verify(purpose: Purpose, token: string): string | null {
  const [userId, sig] = token.split(".")
  if (!userId || !sig) return null
  const expected = Buffer.from(sign(purpose, userId))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null
}

export const createDeviceToken = (userId: string) => create("device", userId)
export const verifyDeviceToken = (token: string) => verify("device", token)
export const createWatchToken = (userId: string) => create("watch", userId)
export const verifyWatchToken = (token: string) => verify("watch", token)

/** Supabase Realtime broadcast channel for one user's raw ~10 Hz samples (not stored). */
export const liveChannelFor = (userId: string) => `live-${sign("live", userId).slice(0, 32)}`
