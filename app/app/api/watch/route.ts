// GET /api/watch?t=<watch token>: Server-Sent Events with one user's live posture readings.
// Viewers (scanned the QR on /device) aren't signed in as the owner, so RLS would hide
// the rows; this route reads them with the service key, only for the token's user.
//   event "snapshot": the latest readings, oldest first (on connect)
//   event "reading":  each new row, pushed by Supabase Realtime as it's inserted
// A 3 s poll runs alongside as a safety net: Realtime can report "subscribed" yet
// send nothing if posture_readings isn't in the supabase_realtime publication.
// EventSource reconnects by itself if the host cuts the stream (serverless time limits).

import { verifyWatchToken } from "@/lib/watch-token";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const COLUMNS =
  "id, session_id, timestamp, avg_pitch_punggung, avg_pitch_leher, slouch_score, status";
const SNAPSHOT_SIZE = 120; // 10 minutes at the default 5 s interval
const POLL_MS = 3000;
const HEARTBEAT_MS = 15_000;

type Row = { id: string; timestamp: string };

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const userId = verifyWatchToken(token);
  if (!userId)
    return Response.json({ error: "Invalid watch link" }, { status: 401 });

  const db = getSupabaseAdmin();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (!closed)
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
      };

      const { data: latest, error } = await db
        .from("posture_readings")
        .select(COLUMNS)
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(SNAPSHOT_SIZE);
      if (error) {
        send("error", { message: error.message });
        controller.close();
        return;
      }
      const rows = (latest ?? []).reverse() as Row[];
      send("snapshot", rows);

      // Newest row we've sent; used by the polling fallback.
      let since = rows.at(-1)?.timestamp ?? new Date(0).toISOString();
      const seen = new Set(rows.map((r) => r.id));
      const push = (row: Row) => {
        if (seen.has(row.id)) return;
        seen.add(row.id);
        if (row.timestamp > since) since = row.timestamp;
        send("reading", row);
      };

      const poller = setInterval(async () => {
        const { data } = await db
          .from("posture_readings")
          .select(COLUMNS)
          .eq("user_id", userId)
          .gt("timestamp", since)
          .order("timestamp")
          .limit(500);
        for (const row of (data ?? []) as Row[]) push(row);
      }, POLL_MS);

      const channel = db
        .channel(`watch-${userId}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "posture_readings",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => push(payload.new as Row),
        )
        .subscribe();

      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(poller);
        db.removeChannel(channel);
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
