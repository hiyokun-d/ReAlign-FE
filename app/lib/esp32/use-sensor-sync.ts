"use client"

// ESP32 → BLE → this hook → Supabase.
// Connects to the sensor, averages the stream into per-minute rows, tracks the
// session, and uploads through the offline outbox every few seconds.
// Once the ESP32 has WiFi set up (setupWifi) and reports NET:OK, it uploads by
// itself through /api/ingest and this hook stops uploading, so rows aren't doubled.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { MinuteAggregator, type MinuteRow } from "@/lib/esp32/aggregate"
import {
  bluetoothSupported,
  connectSensor,
  parseNet,
  sendWifiConfig,
  type NetStatus,
  type SensorConnection,
  type SensorSample,
} from "@/lib/esp32/ble"
import { enqueue as queueRow, flush, pendingCount } from "@/lib/esp32/sync-queue"
import { statusFromScore } from "@/lib/posture"
import { ensureUser } from "@/lib/supabase/client"
import { supabaseConfigured } from "@/lib/supabase/env"

const FLUSH_EVERY_MS = 10_000
// Without Supabase the sensor still works live, it just isn't saved.
const enqueue: typeof queueRow = supabaseConfigured ? queueRow : () => {}

export type SensorStatus = "idle" | "connecting" | "connected" | "error"
export type SyncState = { pending: number; lastSyncedAt: number | null; error: string | null }
export type WifiSetup = { ssid: string; password: string; serverUrl: string }

const noopSubscribe = () => () => {}

export function useSensorSync({ onSynced }: { onSynced?: () => void } = {}) {
  // Server render assumes support so the button doesn't flash disabled.
  const supported = useSyncExternalStore(noopSubscribe, bluetoothSupported, () => true)
  const [status, setStatus] = useState<SensorStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [latest, setLatest] = useState<SensorSample | null>(null)
  const [sync, setSync] = useState<SyncState>({ pending: 0, lastSyncedAt: null, error: null })
  const [net, setNet] = useState<NetStatus>({ state: "unknown" })

  const connRef = useRef<SensorConnection | null>(null)
  const netRef = useRef<NetStatus>({ state: "unknown" })
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
      const agg = new MinuteAggregator()
      // The session row is only written once this browser actually saves a minute.
      let savedAny = false

      const saveSession = (endedAt: string | null) => {
        enqueue("posture_sessions", sessionId, {
          id: sessionId,
          user_id: userId,
          started_at: startedAt,
          ended_at: endedAt,
          total_slouch_seconds: agg.stats().slouchSeconds,
        })
      }
      const saveMinute = (row: MinuteRow | null) => {
        // The ESP32 is uploading over WiFi itself; don't double the rows.
        if (!row || netRef.current.state === "ok") return
        savedAny = true
        enqueue("posture_readings", row.minute, {
          id: crypto.randomUUID(),
          session_id: sessionId,
          user_id: userId,
          timestamp: row.minute,
          avg_pitch_punggung: row.pitch,
          avg_pitch_leher: row.neck_pitch,
          slouch_score: row.score,
          status: statusFromScore(row.score),
        })
        saveSession(null)
      }

      const conn = await connectSensor({
        onSample(sample) {
          setLatest(sample)
          saveMinute(agg.add(sample))
        },
        onLine(line) {
          const status = parseNet(line)
          if (!status) return
          netRef.current = status
          setNet(status)
        },
        onDisconnect() {
          saveMinute(agg.flush())
          if (savedAny) saveSession(new Date().toISOString())
          connRef.current = null
          netRef.current = { state: "unknown" }
          setNet(netRef.current)
          setStatus("idle")
          setLatest(null)
          runFlush()
        },
      })
      if (!conn) return setStatus("idle")

      connRef.current = conn
      setDeviceName(conn.name)
      setStatus("connected")
      // Ask whether the ESP32 already uploads over WiFi (old firmware just ignores this).
      conn.send("WIFI?").catch(() => {})
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

  const forgetWifi = useCallback(() => connRef.current?.send("WIFIOFF"), [])

  const disconnect = useCallback(() => connRef.current?.disconnect(), [])
  useEffect(() => () => connRef.current?.disconnect(), [])

  return {
    supported,
    configured: supabaseConfigured,
    status,
    error,
    deviceName,
    latest,
    sync,
    net,
    setupWifi,
    forgetWifi,
    connect,
    disconnect,
    syncNow: runFlush,
  }
}
