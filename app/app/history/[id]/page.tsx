// Session log — PLACEHOLDER. Owner: frontend team.
// One session and every posture_readings row it recorded (default one per 5 s).

import Link from "next/link";
import { notFound } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { StatusBadge } from "@/components/posture/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionDetail } from "@/lib/data";
import { formatDuration, sessionSeconds } from "@/lib/format";

export default async function SessionPage({ params }: PageProps<"/history/[id]">) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) notFound();
  const { session, readings } = detail;

  return (
    <FadeIn className="flex flex-col gap-6">
      <div>
        <Link href="/history" className="text-sm text-muted-foreground hover:underline">
          ← History
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {new Date(session.startedAt).toLocaleString()}
          {session.endedAt === null && <Badge>Live</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {session.endedAt ? `Ended ${new Date(session.endedAt).toLocaleString()}` : "Still running"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Duration" value={formatDuration(sessionSeconds(session.startedAt, session.endedAt))} />
        <Stat label="Average score" value={String(session.averageScore)} />
        <Stat label="Slouch alerts" value={formatDuration(session.slouchSeconds)} />
        <Stat label="Readings" value={String(readings.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log</CardTitle>
          <CardDescription>Every reading in this session, oldest first</CardDescription>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No readings in this session.</p>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Time</th>
                    <th className="py-2 font-medium">Back pitch</th>
                    <th className="py-2 font-medium">Score</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-1.5">{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td className="py-1.5">{r.pitch}°</td>
                      <td className="py-1.5">{r.score}</td>
                      <td className="py-1.5">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
