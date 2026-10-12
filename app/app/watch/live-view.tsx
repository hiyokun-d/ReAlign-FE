"use client";

import { useEffect, useState } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { ReadingsBarChart } from "@/components/posture/readings-bar-chart";
import { ScoreRing } from "@/components/posture/score-ring";
import { StatusBadge } from "@/components/posture/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LIVE_EVENT, type LiveSample } from "@/lib/esp32/live-broadcast";
import { scoreFromAngles, statusFromScore } from "@/lib/posture";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { PostureReading } from "@/lib/types";

// Two feeds:
//   /api/watch (Server-Sent Events): stored posture_readings rows (snapshot, then each new one) → chart
//   Realtime broadcast: raw ~10 Hz samples while the owner's laptop is on Bluetooth → "Right now"
// When the instant feed goes quiet (ESP32 uploading over WiFi on its own), "Right now"
// falls back to the newest stored row.

type Row = { id: string; timestamp: string; avg_pitch_punggung: number; avg_pitch_leher: number; slouch_score: number };
type Live = PostureReading & { neck: number };

const KEEP = 60; // bars in the chart (5 minutes at the default 5 s interval)
// No reading for this long = the sensor stopped sending.
const STALE_MS = 30_000;
// No broadcast sample for this long = fall back to stored readings.
const INSTANT_STALE_MS = 2000;

const toLive = (r: Row): Live => ({
  id: r.id,
  timestamp: r.timestamp,
  pitch: r.avg_pitch_punggung,
  neck: r.avg_pitch_leher,
  roll: 0,
  score: r.slouch_score,
  status: statusFromScore(r.slouch_score),
});

export function LiveView({ token, channel }: { token: string; channel: string }) {
  const [readings, setReadings] = useState<Live[]>([]);
  const [link, setLink] = useState<"connecting" | "open" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Raw sample + when it arrived here (sender and viewer clocks may differ).
  const [instant, setInstant] = useState<{ sample: LiveSample; at: number } | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const sub = supabase
      .channel(channel, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: LIVE_EVENT }, ({ payload }: { payload: LiveSample }) =>
        setInstant({ sample: payload, at: Date.now() })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channel]);

  useEffect(() => {
    const source = new EventSource(`/api/watch?t=${encodeURIComponent(token)}`);
    source.onopen = () => setLink("open");
    // EventSource retries by itself; show it as reconnecting meanwhile.
    source.onerror = () => setLink("error");
    source.addEventListener("snapshot", (e) => {
      setReadings((JSON.parse(e.data) as Row[]).map(toLive).slice(-KEEP));
    });
    source.addEventListener("reading", (e) => {
      const row = toLive(JSON.parse(e.data) as Row);
      setReadings((prev) =>
        [...prev, row].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-KEEP)
      );
    });
    // Server-sent "error" event (bad link etc.), not a dropped connection.
    source.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) setError(JSON.parse(e.data).message);
    });
    return () => source.close();
  }, [token]);

  // Ticks "x s ago" and the stale check.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const latest = readings.at(-1);
  const ageMs = latest ? now - new Date(latest.timestamp).getTime() : Infinity;
  const fresh = instant && now - instant.at < INSTANT_STALE_MS ? instant.sample : null;
  const live = fresh !== null || (link === "open" && ageMs < STALE_MS);

  // "Right now": the instant sample when there is one, else the newest stored row.
  const current = fresh
    ? (() => {
        const score = scoreFromAngles(fresh.b, fresh.br);
        return { score, status: statusFromScore(score), back: fresh.b, neck: fresh.n, motor: fresh.m === 1 };
      })()
    : latest
      ? { score: latest.score, status: latest.status, back: latest.pitch, neck: latest.neck, motor: false }
      : null;

  return (
    <FadeIn className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Live posture</h1>
        {fresh ? (
          <Badge>Live · instant</Badge>
        ) : live ? (
          <Badge>Live · every few s</Badge>
        ) : (
          <Badge variant="outline">{link === "error" ? "Reconnecting…" : "Waiting for sensor"}</Badge>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Right now</CardTitle>
            <CardDescription>
              {fresh
                ? "Instant, straight from the sensor"
                : latest
                  ? `Updated ${Math.max(0, Math.round(ageMs / 1000))} s ago`
                  : "No readings yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {current ? (
              <>
                <ScoreRing score={current.score} />
                <StatusBadge status={current.status} />
                <p className="text-xs text-muted-foreground tabular-nums">
                  back {current.back.toFixed(1)}° · neck {current.neck.toFixed(1)}°
                  {current.motor && " · buzzing"}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for the sensor to send data…</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full md:col-span-2">
          <CardHeader>
            <CardTitle>Recent</CardTitle>
            <CardDescription>One bar per reading, height = score</CardDescription>
          </CardHeader>
          <CardContent>
            <ReadingsBarChart readings={readings} />
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
