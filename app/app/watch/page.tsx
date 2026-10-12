// /watch?t=TOKEN — live posture for viewers who scanned the QR on /device.
// No login: the signed token in the link decides whose readings are shown.

import type { Metadata } from "next";
import { liveChannelFor, verifyWatchToken } from "@/lib/device-token";
import { LiveView } from "./live-view";

export const metadata: Metadata = {
  title: "reallign · live",
  robots: { index: false, follow: false },
};

export default async function WatchPage({ searchParams }: PageProps<"/watch">) {
  const { t } = await searchParams;
  const userId = typeof t === "string" ? verifyWatchToken(t) : null;
  if (!userId) {
    return <p className="text-sm text-muted-foreground">This watch link isn&apos;t valid. Scan the QR again.</p>;
  }
  return <LiveView token={t as string} channel={liveChannelFor(userId)} />;
}
