// POST /api/ingest: the ESP32 uploads per-minute readings over WiFi.
// Auth: "Authorization: Bearer <device token>" (see lib/device-token.ts).
// Body: { session: {id, started_at, ended_at, total_slouch_seconds},
//         readings: [{id, timestamp, avg_pitch_punggung, avg_pitch_leher, slouch_score, status}] }
// Ids come from the device, so retries are safe: readings are insert-only.

import { verifyDeviceToken } from "@/lib/device-token"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES = new Set(["good", "warning", "bad"])
const MAX_READINGS = 200

type Session = { id: string; started_at: string; ended_at: string | null; total_slouch_seconds: number }
type Reading = {
  id: string
  timestamp: string
  avg_pitch_punggung: number
  avg_pitch_leher: number
  slouch_score: number
  status: string
}

const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v))
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v)

function validSession(s: Session) {
  return UUID.test(s?.id) && isDate(s.started_at) && (s.ended_at === null || isDate(s.ended_at)) && isNum(s.total_slouch_seconds)
}

function validReading(r: Reading) {
  return (
    UUID.test(r?.id) &&
    isDate(r.timestamp) &&
    isNum(r.avg_pitch_punggung) &&
    isNum(r.avg_pitch_leher) &&
    Number.isInteger(r.slouch_score) &&
    STATUSES.has(r.status)
  )
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  const userId = verifyDeviceToken(token)
  if (!userId) return Response.json({ error: "Invalid device token" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { session?: Session; readings?: Reading[] } | null
  const { session, readings = [] } = body ?? {}
  if (!session || !validSession(session) || !Array.isArray(readings) || readings.length > MAX_READINGS || !readings.every(validReading)) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // The service key skips RLS, so check ownership by hand before updating a session.
  const { data: existing, error: lookupError } = await db.from("posture_sessions").select("user_id").eq("id", session.id).maybeSingle()
  if (lookupError) return Response.json({ error: lookupError.message }, { status: 500 })
  if (existing && existing.user_id !== userId) return Response.json({ error: "Session belongs to another user" }, { status: 409 })

  const { error: sessionError } = await db.from("posture_sessions").upsert({
    id: session.id,
    user_id: userId,
    started_at: session.started_at,
    ended_at: session.ended_at,
    total_slouch_seconds: Math.max(0, Math.round(session.total_slouch_seconds)),
  })
  if (sessionError) return Response.json({ error: sessionError.message }, { status: 500 })

  if (readings.length) {
    const { error } = await db.from("posture_readings").upsert(
      readings.map((r) => ({
        id: r.id,
        session_id: session.id,
        user_id: userId,
        timestamp: r.timestamp,
        avg_pitch_punggung: r.avg_pitch_punggung,
        avg_pitch_leher: r.avg_pitch_leher,
        slouch_score: Math.min(100, Math.max(0, r.slouch_score)),
        status: r.status,
      })),
      { onConflict: "id", ignoreDuplicates: true }
    )
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, saved: readings.length })
}
