// Data access layer — THE ONLY place the UI gets data from.
//
// With NEXT_PUBLIC_SUPABASE_* set (see .env.example), everything is read from
// Supabase. The browser fills those tables: ESP32 → BLE → lib/esp32/use-sensor-sync.ts.
// Without them, every function returns dummy data from lib/mock-data.ts.
//
// Frontend devs: do NOT import lib/mock-data.ts or Supabase directly in components.
// If you need data that isn't here yet, add a function below.

import {
  mockDailySummaries,
  mockDevice,
  mockReadings,
  mockSessions,
} from "@/lib/mock-data"
import { statusFromScore } from "@/lib/posture"
import { supabaseConfigured } from "@/lib/supabase/env"
import { getSupabaseServer } from "@/lib/supabase/server"
import type {
  DailySummary,
  Device,
  PostureReading,
  PostureSession,
} from "@/lib/types"

// Fake network delay so loading states actually show up during development.
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

/** Rows come back empty (not an error) before the browser has signed in; RLS hides the rest. */
async function query<T>(build: (db: Awaited<ReturnType<typeof getSupabaseServer>>) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await build(await getSupabaseServer())
  if (error) throw new Error(error.message)
  return data ?? []
}

// Tables (already in Supabase): posture_sessions, posture_readings (one row per minute).
// slouch_score is our 0–100 posture score (higher = better); status is good/warning/bad.
type ReadingRow = { timestamp: string; avg_pitch_punggung: number; slouch_score: number; status: string }
const READING_COLUMNS = "timestamp, avg_pitch_punggung, slouch_score, status"
const toReading = (r: ReadingRow): PostureReading => ({
  id: r.timestamp,
  timestamp: r.timestamp,
  pitch: r.avg_pitch_punggung,
  roll: 0, // not stored
  score: r.slouch_score,
  status: statusFromScore(r.slouch_score),
})

export async function getDevice(): Promise<Device | null> {
  if (!supabaseConfigured) {
    await delay()
    return mockDevice
  }
  // There's no devices table; the sensor "exists" once it has sent a reading.
  const [last] = await query<{ timestamp: string }>((db) =>
    db.from("posture_readings").select("timestamp").order("timestamp", { ascending: false }).limit(1)
  )
  if (!last) return null
  return {
    id: "esp32",
    name: "Reallign Sensor",
    // The server can't see BLE; "connected" here means data arrived in the last 2 minutes.
    connected: Date.now() - new Date(last.timestamp).getTime() < 2 * 60_000,
    battery: 0, // firmware doesn't report it yet
    firmwareVersion: "unknown",
    lastSeenAt: last.timestamp,
  }
}

export async function getRecentReadings(limit = 60): Promise<PostureReading[]> {
  if (!supabaseConfigured) {
    await delay()
    return mockReadings.slice(-limit)
  }
  const rows = await query<ReadingRow>((db) =>
    db.from("posture_readings").select(READING_COLUMNS).order("timestamp", { ascending: false }).limit(limit)
  )
  return rows.reverse().map(toReading)
}

export async function getLatestReading(): Promise<PostureReading | null> {
  if (!supabaseConfigured) {
    await delay()
    return mockReadings[mockReadings.length - 1]
  }
  const [latest] = await getRecentReadings(1)
  return latest ?? null
}

/** Minute rows → the numbers both sessions and daily summaries show. */
function summarize(readings: { slouch_score: number; status: string }[]) {
  return {
    averageScore: readings.length
      ? Math.round(readings.reduce((sum, r) => sum + r.slouch_score, 0) / readings.length)
      : 0,
    // Minutes spent slouching, the closest thing the tables store to "slouches".
    slouchCount: readings.filter((r) => r.status === "bad").length,
    goodMinutes: readings.filter((r) => r.status === "good").length,
  }
}

export async function getSessions(): Promise<PostureSession[]> {
  if (!supabaseConfigured) {
    await delay()
    return mockSessions
  }
  const rows = await query<{
    id: string
    started_at: string
    ended_at: string | null
    posture_readings: { slouch_score: number; status: string }[]
  }>((db) =>
    db
      .from("posture_sessions")
      .select("id, started_at, ended_at, posture_readings(slouch_score, status)")
      .order("started_at", { ascending: false })
      .limit(20)
  )
  return rows.map((s) => {
    const { averageScore, slouchCount, goodMinutes } = summarize(s.posture_readings)
    return { id: s.id, startedAt: s.started_at, endedAt: s.ended_at, averageScore, slouchCount, goodMinutes }
  })
}

/** Last 7 days (UTC), oldest first. */
export async function getDailySummaries(): Promise<DailySummary[]> {
  if (!supabaseConfigured) {
    await delay()
    return mockDailySummaries
  }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()
  // TODO: a SQL view/RPC once a week of minutes passes PostgREST's 1000-row default cap.
  const rows = await query<{ timestamp: string; slouch_score: number; status: string }>((db) =>
    db.from("posture_readings").select("timestamp, slouch_score, status").gte("timestamp", since).limit(10_080)
  )
  const byDay = Map.groupBy(rows, (r) => r.timestamp.slice(0, 10))
  return [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const { averageScore, slouchCount } = summarize(day)
      return { date, averageScore, slouchCount, trackedMinutes: day.length }
    })
}
