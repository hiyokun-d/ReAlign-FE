// POST /api/watch-token: the signed-in owner gets a link token for the QR code on /device,
// and the live channel name its browser broadcasts raw samples on.

import { createWatchToken, liveChannelFor } from "@/lib/watch-token"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await getSupabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return Response.json({ error: "Not signed in" }, { status: 401 })
  return Response.json({ token: createWatchToken(data.user.id), channel: liveChannelFor(data.user.id) })
}
