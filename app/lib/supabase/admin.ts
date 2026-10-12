// Service client: bypasses row-level security. Server only, for /api/ingest,
// where the ESP32 has a device token instead of a Supabase session.

import "server-only"
import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL } from "@/lib/supabase/env"

export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set")
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
