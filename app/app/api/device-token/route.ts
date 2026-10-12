// POST /api/device-token: the signed-in browser gets a token to hand to its ESP32.

import { createDeviceToken } from "@/lib/device-token"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await getSupabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return Response.json({ error: "Not signed in" }, { status: 401 })
  return Response.json({ token: createDeviceToken(data.user.id) })
}
