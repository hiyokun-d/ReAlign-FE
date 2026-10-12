// Data access layer — THE ONLY place the UI gets data from.
//
// With NEXT_PUBLIC_SUPABASE_* set (see .env.example), everything is read from
// Supabase. Filled by the browser connected to the sensor (ESP32 → BLE →
// lib/esp32/use-sensor-sync.ts). Live viewing on other devices: /watch.
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
  SessionDetail,
} from "@/lib/types"

// Fake network delay so loading states actually show up during development.
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

/** Rows come back empty (not an error) before the browser has signed in; RLS hides the rest. */
async function query<T>(build: (db: Awaited<ReturnType<typeof getSupabaseServer>>) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await build(await getSupabaseServer())
  if (error) throw new Error(error.message)
  return data ?? []
}

// Tables (already in Supabase): posture_sessions, posture_readings (one row every
// few seconds, default 5). slouch_score is our 0–100 posture score (higher = better).
type Db = Awaited<ReturnType<typeof getSupabaseServer>>
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

// PostgREST returns at most 1000 rows per request, so long ranges are fetched in pages.
const PAGE = 1000
const MAX_ROWS = 20_000 // ~28 h of 5 s readings; enough for a prototype

async function queryAll<T>(build: (db: Db, from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const db = await getSupabaseServer()
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(db, from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

/** Averages rows into one per minute, so charts and stats don't depend on the upload interval. */
function perMinute(rows: ReadingRow[]): ReadingRow[] {
  const byMinute = Map.groupBy(rows, (r) => new Date(r.timestamp).toISOString().slice(0, 16))
  return [...byMinute]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([minute, group]) => {
      const score = Math.round(group.reduce((sum, r) => sum + r.slouch_score, 0) / group.length)
      return {
        timestamp: `${minute}:00.000Z`,
        avg_pitch_punggung: Math.round((group.reduce((sum, r) => sum + r.avg_pitch_punggung, 0) / group.length) * 10) / 10,
        slouch_score: score,
        status: statusFromScore(score),
      }
    })
}

/** Readings → the numbers sessions and daily summaries show, counted per minute. */
function summarize(rows: ReadingRow[]) {
  const minutes = perMinute(rows)
  return {
    averageScore: minutes.length ? Math.round(minutes.reduce((sum, m) => sum + m.slouch_score, 0) / minutes.length) : 0,
    // Minutes spent slouching, the closest thing the tables store to "slouches".
    slouchCount: minutes.filter((m) => m.status === "bad").length,
    goodMinutes: minutes.filter((m) => m.status === "good").length,
    trackedMinutes: minutes.length,
  }
}

type SessionRow = { id: string; started_at: string; ended_at: string | null; total_slouch_seconds: number | null }

// ended_at moves forward with every reading (browser and ESP32 alike), so a session
// whose last reading is this recent is still running.
const LIVE_WITHIN_MS = 30_000

/** Older sessions have no ended_at; their last reading marks the end instead. */
function sessionEnd(s: SessionRow, readings: ReadingRow[]): string | null {
  const end = s.ended_at ?? readings.at(-1)?.timestamp ?? null
  return end && Date.now() - new Date(end).getTime() < LIVE_WITHIN_MS ? null : end
}

function toSession(s: SessionRow, readings: ReadingRow[]): PostureSession {
  const { averageScore, slouchCount, goodMinutes } = summarize(readings)
  return {
    id: s.id,
    startedAt: s.started_at,
    endedAt: sessionEnd(s, readings),
    averageScore,
    slouchCount,
    goodMinutes,
    slouchSeconds: s.total_slouch_seconds ?? 0,
  }
}

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

/** The last `limit` minutes that have data, one averaged reading per minute. */
export async function getRecentReadings(limit = 60): Promise<PostureReading[]> {
  if (!supabaseConfigured) {
    await delay()
    return mockReadings.slice(-limit)
  }
  const since = new Date(Date.now() - limit * 60_000).toISOString()
  const rows = await queryAll<ReadingRow>((db, from, to) =>
    db.from("posture_readings").select(READING_COLUMNS).gte("timestamp", since).order("timestamp").range(from, to)
  )
  return perMinute(rows).slice(-limit).map(toReading)
}

/** The newest raw reading (not averaged), a few seconds old at most while live. */
export async function getLatestReading(): Promise<PostureReading | null> {
  if (!supabaseConfigured) {
    await delay()
    return mockReadings[mockReadings.length - 1]
  }
  const [latest] = await query<ReadingRow>((db) =>
    db.from("posture_readings").select(READING_COLUMNS).order("timestamp", { ascending: false }).limit(1)
  )
  return latest ? toReading(latest) : null
}

export async function getSessions(): Promise<PostureSession[]> {
  if (!supabaseConfigured) {
    await delay()
    return mockSessions
  }
  const sessions = await query<SessionRow>((db) =>
    db.from("posture_sessions").select("id, started_at, ended_at, total_slouch_seconds").order("started_at", { ascending: false }).limit(20)
  )
  if (!sessions.length) return []
  const readings = await queryAll<ReadingRow & { session_id: string }>((db, from, to) =>
    db
      .from("posture_readings")
      .select(`session_id, ${READING_COLUMNS}`)
      .in("session_id", sessions.map((s) => s.id))
      .order("timestamp")
      .range(from, to)
  )
  const bySession = Map.groupBy(readings, (r) => r.session_id)
  return sessions.map((s) => toSession(s, bySession.get(s.id) ?? []))
}

/** One session and its full log of readings (every row, not averaged), oldest first. */
export async function getSessionDetail(id: string): Promise<SessionDetail | null> {
  if (!supabaseConfigured) {
    await delay()
    const session = mockSessions.find((s) => s.id === id)
    return session ? { session, readings: mockReadings } : null
  }
  const [session] = await query<SessionRow>((db) =>
    db.from("posture_sessions").select("id, started_at, ended_at, total_slouch_seconds").eq("id", id).limit(1)
  )
  if (!session) return null
  const readings = await queryAll<ReadingRow>((db, from, to) =>
    db.from("posture_readings").select(READING_COLUMNS).eq("session_id", id).order("timestamp").range(from, to)
  )
  return { session: toSession(session, readings), readings: readings.map(toReading) }
}

/** Last 7 days (UTC), oldest first. */
export async function getDailySummaries(): Promise<DailySummary[]> {
  if (!supabaseConfigured) {
    await delay()
    return mockDailySummaries
  }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()
  const rows = await queryAll<ReadingRow>((db, from, to) =>
    db.from("posture_readings").select(READING_COLUMNS).gte("timestamp", since).order("timestamp").range(from, to)
  )
  const byDay = Map.groupBy(rows, (r) => new Date(r.timestamp).toISOString().slice(0, 10))
  return [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const { averageScore, slouchCount, trackedMinutes } = summarize(day)
      return { date, averageScore, slouchCount, trackedMinutes }
    })
}
