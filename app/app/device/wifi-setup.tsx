"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NetStatus } from "@/lib/esp32/ble";
import type { WifiSetup as WifiSettings } from "@/lib/esp32/use-sensor-sync";
import { defaultPublicOrigin, isLocalhostUrl } from "@/lib/public-url";

// Sends WiFi settings to the ESP32 over the Bluetooth link it's already on.
// After that the sensor uploads by itself, no phone or open tab needed.

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WifiSetup({
  net,
  onSave,
  onForget,
}: {
  net: NetStatus;
  onSave(settings: WifiSettings): Promise<void>;
  onForget(): void;
}) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(defaultPublicOrigin);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(net.state !== "ok");

  const localhostUrl = isLocalhostUrl(serverUrl);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ssid, password, serverUrl });
      toast.success("Sent to the sensor. It's connecting to WiFi…");
      setPassword("");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Sensor WiFi</span>
        <NetBadge net={net} />
      </div>
      <p className="text-xs text-muted-foreground">
        {net.state === "ok"
          ? "The sensor uploads by itself, even with this page closed."
          : "Set WiFi so the sensor uploads by itself, without this page open."}
      </p>

      {!open ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Change WiFi
          </Button>
          {net.state !== "off" && (
            <Button size="sm" variant="ghost" onClick={onForget}>
              Forget WiFi
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-2">
          <input className={inputClass} placeholder="WiFi name" value={ssid} onChange={(e) => setSsid(e.target.value)} required />
          <input
            className={inputClass}
            type="password"
            placeholder="WiFi password (empty if open)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className={inputClass}
            type="url"
            placeholder="Server, e.g. https://reallign.vercel.app or http://192.168.1.5:3000"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {localhostUrl
              ? "localhost won't work: the sensor would call itself. Use this computer's network address (shown as \"Network\" when you run bun dev) or the deployed site."
              : "2.4 GHz WiFi only. The sensor must be able to reach this server address."}
          </p>
          <Button type="submit" size="sm" disabled={saving || localhostUrl}>
            {saving ? "Sending…" : "Send to sensor"}
          </Button>
        </form>
      )}
    </div>
  );
}

function NetBadge({ net }: { net: NetStatus }) {
  switch (net.state) {
    case "ok":
      return <Badge>Online · {net.ip}</Badge>;
    case "connecting":
      return <Badge variant="outline">Connecting…</Badge>;
    case "fail":
      return <Badge variant="destructive">Failed: {net.reason}</Badge>;
    case "off":
      return <Badge variant="outline">Not set</Badge>;
    default:
      return <Badge variant="outline">Checking…</Badge>;
  }
}
