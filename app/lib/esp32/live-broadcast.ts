"use client"

// Raw sensor samples → Supabase Realtime broadcast → /watch viewers, ~10 per second.
// Not stored: the database still gets one posture_readings row per interval.
// The channel name comes from the server (lib/device-token.ts liveChannelFor), so only
// this owner and people with a watch link know it.

import type { SensorSample } from "@/lib/esp32/ble"
import { getSupabaseBrowser } from "@/lib/supabase/client"

export const LIVE_EVENT = "sample"
const SEND_EVERY_MS = 100 // 10 Hz; the sensor streams 20 Hz

/** What viewers receive. Short keys keep each message small. */
export type LiveSample = {
  t: number // Date.now() on the sender
  b: number // back pitch
  n: number // neck pitch
  br: number // back roll
  nr: number // neck roll
  m: 0 | 1 // motor buzzing
}

export type LiveBroadcast = { push(sample: SensorSample): void; stop(): void }

export async function startLiveBroadcast(): Promise<LiveBroadcast> {
  const res = await fetch("/api/watch-token", { method: "POST" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.channel) throw new Error(body.error ?? `Couldn't start live view (${res.status})`)

  const supabase = getSupabaseBrowser()
  let ready = false
  const channel = supabase
    .channel(body.channel, { config: { broadcast: { self: false, ack: false } } })
    .subscribe((status: string) => {
      ready = status === "SUBSCRIBED"
    })

  let lastSent = 0
  return {
    push(s) {
      if (!ready || s.at - lastSent < SEND_EVERY_MS) return
      lastSent = s.at
      const payload: LiveSample = { t: s.at, b: s.back, n: s.neck, br: s.backRoll, nr: s.neckRoll, m: s.motor ? 1 : 0 }
      channel.send({ type: "broadcast", event: LIVE_EVENT, payload })
    },
    stop() {
      ready = false
      supabase.removeChannel(channel)
    },
  }
}
