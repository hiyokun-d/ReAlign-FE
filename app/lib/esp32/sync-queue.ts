"use client"

// Offline-first outbox: rows are queued in localStorage, keyed by primary key
// (so a session updated 30 times is uploaded once), then upserted to Supabase.
// A dropped connection or closed tab loses nothing; the next flush sends it.

import { getSupabaseBrowser } from "@/lib/supabase/client"

type Row = Record<string, unknown>
type Outbox = { posture_sessions: Record<string, Row>; posture_readings: Record<string, Row> }

const KEY = "reallign:outbox:v2"
// Parents first so posture_readings.session_id resolves. Ids are made in the
// browser, so re-sending a row updates it instead of duplicating it.
const TABLES = ["posture_sessions", "posture_readings"] as const

function load(): Outbox {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { posture_sessions: {}, posture_readings: {} }
}

function save(outbox: Outbox) {
  try {
    localStorage.setItem(KEY, JSON.stringify(outbox))
  } catch {}
}

export function enqueue(table: keyof Outbox, key: string, row: Row) {
  const outbox = load()
  outbox[table][key] = row
  save(outbox)
}

export function pendingCount() {
  const o = load()
  return Object.keys(o.posture_sessions ?? {}).length + Object.keys(o.posture_readings ?? {}).length
}

let flushing: Promise<void> | null = null

/** Uploads everything queued. Rows that change mid-flush stay queued for next time. */
export function flush(): Promise<void> {
  flushing ??= (async () => {
    try {
      const supabase = getSupabaseBrowser()
      for (const table of TABLES) {
        const sent = load()[table] ?? {}
        const rows = Object.values(sent)
        if (rows.length === 0) continue
        const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" })
        if (error) throw new Error(`${table}: ${error.message}`)
        const outbox = load()
        for (const [key, row] of Object.entries(sent)) {
          if (JSON.stringify(outbox[table][key]) === JSON.stringify(row)) delete outbox[table][key]
        }
        save(outbox)
      }
    } finally {
      flushing = null
    }
  })()
  return flushing
}
