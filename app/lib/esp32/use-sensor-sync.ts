"use client"

// ESP32 → BLE → this hook → Supabase.
// Connects to the sensor, averages the stream into one posture_readings row per
// interval (default 5 s, so other devices can watch live), tracks the session,
// and uploads each row right away through the offline outbox.
// Once the ESP32 has WiFi set up (setupWifi) and reports NET:OK, it uploads by
// itself through /api/ingest and this hook stops uploading, so rows aren't doubled.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  DEFAULT_READING_INTERVAL,
  IntervalAggregator,
  READING_INTERVALS,
  type IntervalRow,
} from "@/lib/esp32/aggregate"
import {
  bluetoothSupported,
  connectSensor,
  parseNet,
  parsePeers,
  sendWifiConfig,
  type NetStatus,
  type SensorConnection,
  type SensorSample,
} from "@/lib/esp32/ble"
import { startLiveBroadcast, type LiveBroadcast } from "@/lib/esp32/live-broadcast"
import { enqueue as queueRow, flush, pendingCount } from "@/lib/esp32/sync-queue"
import { statusFromScore } from "@/lib/posture"
import { ensureUser } from "@/lib/supabase/client"
import { supabaseConfigured } from "@/lib/supabase/env"

// Retry timer for leftovers; new rows are uploaded as soon as they're made.
const FLUSH_EVERY_MS = 10_000
const INTERVAL_KEY = "reallign:reading-interval"
// Without Supabase the sensor still works live, it just isn't saved.
const enqueue: typeof queueRow = supabaseConfigured ? queueRow : () => {}

export type SensorStatus = "idle" | "connecting" | "connected" | "error"
export type SyncState = { pending: number; lastSyncedAt: number | null; error: string | null }
export type WifiSetup = { ssid: string; password: string; serverUrl: string }

const noopSubscribe = () => () => {}

function savedInterval() {
  try {
    const v = Number(localStorage.getItem(INTERVAL_KEY))
    if ((READING_INTERVALS as readonly number[]).includes(v)) return v
  } catch {}
  return DEFAULT_READING_INTERVAL
}

export function useSensorSync({ onSynced }: { onSynced?: () => void } = {}) {
  // Server render assumes support so the button doesn't flash disabled.
  const supported = useSyncExternalStore(noopSubscribe, bluetoothSupported, () => true)
  const [status, setStatus] = useState<SensorStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [latest, setLatest] = useState<SensorSample | null>(null)
  const [sync, setSync] = useState<SyncState>({ pending: 0, lastSyncedAt: null, error: null })
  const [net, setNet] = useState<NetStatus>({ state: "unknown" })
  /** Phones/laptops connected to the sensor, this one included (null = old firmware). */
  const [peers, setPeers] = useState<number | null>(null)
  /** Seconds between posture_readings rows (browser and ESP32 alike). */
  const [intervalSec, setIntervalState] = useState(DEFAULT_READING_INTERVAL)
  const intervalRef = useRef(DEFAULT_READING_INTERVAL)
  useEffect(() => {
    intervalRef.current = savedInterval()
    setIntervalState(intervalRef.current)
  }, [])

  const connRef = useRef<SensorConnection | null>(null)
  const netRef = useRef<NetStatus>({ state: "unknown" })
  const aggRef = useRef<IntervalAggregator | null>(null)
  /** Raw samples to /watch viewers while Bluetooth is connected. */
  const liveRef = useRef<LiveBroadcast | null>(null)
  /** Saves the last row of a replaced aggregator and carries its slouch time over. */
  const switchAggRef = useRef<(intervalMs: number) => void>(() => {})
  const onSyncedRef = useRef(onSynced)
  useEffect(() => {
    onSyncedRef.current = onSynced
  })

  const runFlush = useCallback(async () => {
    if (!supabaseConfigured) return setSync((s) => ({ ...s, pending: pendingCount() }))
    try {
      await flush()
      setSync({ pending: pendingCount(), lastSyncedAt: Date.now(), error: null })
      onSyncedRef.current?.()
    } catch (err) {
      setSync((s) => ({ ...s, pending: pendingCount(), error: (err as Error).message }))
    }
  }, [])

  // Upload leftovers from earlier visits, then keep flushing while the page is open.
  useEffect(() => {
    runFlush()
    const timer = setInterval(runFlush, FLUSH_EVERY_MS)
    window.addEventListener("online", runFlush)
    return () => {
      clearInterval(timer)
      window.removeEventListener("online", runFlush)
    }
  }, [runFlush])

  const connect = useCallback(async () => {
    setError(null)
    setStatus("connecting")
    try {
      const userId = supabaseConfigured ? (await ensureUser()).id : "local"
      const sessionId = crypto.randomUUID()
      const startedAt = new Date().toISOString()
      aggRef.current = new IntervalAggregator(intervalRef.current * 1000)
      // Slouch time is summed across interval changes (each change starts a new aggregator).
      let slouchBefore = 0
      // The session row is only written once this browser actually saves a reading.
      let savedAny = false

      // ended_at = time of the last reading, updated with every row. If the tab is closed
      // or reloaded (no clean disconnect), the session still has its real length.
      const saveSession = (endedAt: string) => {
        enqueue("posture_sessions", sessionId, {
          id: sessionId,
          user_id: userId,
          started_at: startedAt,
          ended_at: endedAt,
          total_slouch_seconds: slouchBefore + (aggRef.current?.stats().slouchSeconds ?? 0),
        })
      }
      const saveRow = (row: IntervalRow | null) => {
        // The ESP32 is uploading over WiFi itself; don't double the rows.
        if (!row || netRef.current.state === "ok") return
        savedAny = true
        enqueue("posture_readings", row.start, {
          id: crypto.randomUUID(),
          session_id: sessionId,
          user_id: userId,
          timestamp: row.start,
          avg_pitch_punggung: row.pitch,
          avg_pitch_leher: row.neck_pitch,
          slouch_score: row.score,
          status: statusFromScore(row.score),
        })
        saveSession(new Date().toISOString())
        runFlush() // live: upload now, not on the retry timer
      }
      switchAggRef.current = (intervalMs) => {
        const old = aggRef.current
        if (!old) return
        const last = old.flush()
        slouchBefore += old.stats().slouchSeconds
        aggRef.current = new IntervalAggregator(intervalMs)
        saveRow(last)
      }

      const conn = await connectSensor({
        onSample(sample) {
          setLatest(sample)
          liveRef.current?.push(sample)
          saveRow(aggRef.current?.add(sample) ?? null)
        },
        onLine(line) {
          const count = parsePeers(line)
          if (count !== null) return setPeers(count)
          const status = parseNet(line)
          if (!status) return
          netRef.current = status
          setNet(status)
        },
        onDisconnect() {
          saveRow(aggRef.current?.flush() ?? null)
          if (savedAny) saveSession(new Date().toISOString())
          aggRef.current = null
          liveRef.current?.stop()
          liveRef.current = null
          connRef.current = null
          netRef.current = { state: "unknown" }
          setNet(netRef.current)
          setPeers(null)
          setStatus("idle")
          setLatest(null)
          runFlush()
        },
      })
      if (!conn) return setStatus("idle")

      connRef.current = conn
      setDeviceName(conn.name)
      setStatus("connected")
      // Same interval on the ESP32's own WiFi upload; ask whether it's already uploading.
      // (Old firmware just ignores both.)
      conn.send(`WI=${intervalRef.current}`).catch(() => {})
      conn.send("WIFI?").catch(() => {})
      if (supabaseConfigured) {
        startLiveBroadcast()
          .then((live) => {
            // Disconnected while the channel was starting.
            if (connRef.current === conn) liveRef.current = live
            else live.stop()
          })
          .catch((err: Error) => setError(`Live view unavailable: ${err.message}`))
      }
      runFlush()
    } catch (err) {
      setStatus("error")
      setError((err as Error).message)
    }
  }, [runFlush])

  /** Gets a device token for this user and sends WiFi + server settings to the ESP32 over BLE. */
  const setupWifi = useCallback(async ({ ssid, password, serverUrl }: WifiSetup) => {
    const conn = connRef.current
    if (!conn) throw new Error("Connect the sensor first.")
    const res = await fetch("/api/device-token", { method: "POST" })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error ?? `Couldn't get a device token (${res.status})`)
    await sendWifiConfig(conn, {
      ssid,
      password,
      ingestUrl: `${serverUrl.replace(/\/+$/, "")}/api/ingest`,
      token: body.token,
    })
  }, [])

  const setIntervalSec = useCallback((sec: number) => {
    intervalRef.current = sec
    setIntervalState(sec)
    try {
      localStorage.setItem(INTERVAL_KEY, String(sec))
    } catch {}
    // Close the running interval and continue with the new length.
    switchAggRef.current(sec * 1000)
    connRef.current?.send(`WI=${sec}`).catch(() => {})
  }, [])

  /** Operator: the sensor disconnects every other phone/laptop (firmware KICK command). */
  const kickOthers = useCallback(() => connRef.current?.send("KICK"), [])

  const forgetWifi = useCallback(() => connRef.current?.send("WIFIOFF"), [])

  const disconnect = useCallback(() => connRef.current?.disconnect(), [])
  useEffect(
    () => () => {
      connRef.current?.disconnect()
      liveRef.current?.stop()
    },
    []
  )

  return {
    supported,
    configured: supabaseConfigured,
    status,
    error,
    deviceName,
    latest,
    sync,
    net,
    peers,
    kickOthers,
    intervalSec,
    setIntervalSec,
    setupWifi,
    forgetWifi,
    connect,
    disconnect,
    syncNow: runFlush,
  }
}
