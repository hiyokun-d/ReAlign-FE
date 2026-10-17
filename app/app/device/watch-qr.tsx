"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultPublicOrigin, isLocalhostUrl } from "@/lib/public-url";
import { ensureUser } from "@/lib/supabase/client";

// QR code for watching live readings on another device (phone, laptop, TV).
// The link carries a signed watch token, so the viewer needs no login.
// Anyone with the link can watch, so only show it to people you trust.

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WatchQr() {
  const [token, setToken] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function show() {
    setLoading(true);
    try {
      await ensureUser();
      const res = await fetch("/api/watch-token", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Couldn't create a watch link (${res.status})`);
      setBaseUrl(defaultPublicOrigin());
      setToken(body.token);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const base = baseUrl.replace(/\/+$/, "");
  const link = token && base && !isLocalhostUrl(base) ? `${base}/watch?t=${encodeURIComponent(token)}` : null;

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Watch on another device</CardTitle>
        <CardDescription>Scan to see posture live on a phone or laptop, no login needed.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {!token ? (
          <Button onClick={show} disabled={loading} className="w-full">
            {loading ? "Creating link…" : "Show QR code"}
          </Button>
        ) : (
          <>
            {!defaultPublicOrigin() && (
              <input
                className={inputClass}
                type="url"
                placeholder="This computer's address, e.g. http://192.168.1.5:3000"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            )}
            {link ? (
              <>
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={link} size={176} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied"))}
                >
                  Copy link
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                You&apos;re on localhost, which other devices can&apos;t open. Enter the &quot;Network&quot; address that
                bun dev prints, or use the deployed site.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
