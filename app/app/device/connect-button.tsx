"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/posture/status-badge";
import { WifiSetup } from "@/app/device/wifi-setup";
import { Button } from "@/components/ui/button";
import { useSensorSync } from "@/lib/esp32/use-sensor-sync";
import { scoreFromAngles, statusFromScore } from "@/lib/posture";

// Connects to the ESP32 over Web Bluetooth and syncs to Supabase while this page is open.
export function ConnectButton() {
  const router = useRouter();
  // Re-render the server parts (last seen, etc.) after each upload.
  const sensor = useSensorSync({ onSynced: () => router.refresh() });
  const { latest, sync } = sensor;
  const score = latest ? scoreFromAngles(latest.back, latest.backRoll) : null;

  return (
    <div className="flex w-full flex-col gap-3">
      {sensor.status === "connected" ? (
        <Button variant="outline" onClick={sensor.disconnect}>
          Disconnect {sensor.deviceName}
        </Button>
      ) : (
        <Button onClick={sensor.connect} disabled={sensor.status === "connecting" || !sensor.supported}>
          {sensor.status === "connecting" ? "Connecting…" : "Connect sensor"}
        </Button>
      )}

      {!sensor.supported && (
        <p className="text-xs text-muted-foreground">
          This browser can&apos;t use Bluetooth. Use Chrome or Edge, or the Bluefy app on iPhone.
        </p>
      )}
      {sensor.error && <p className="text-xs text-destructive">{sensor.error}</p>}

      {latest && score !== null && (
        <div className="flex items-center justify-between text-sm tabular-nums">
          <span>
            back {latest.back.toFixed(1)}° · neck {latest.neck.toFixed(1)}° · score {score}
          </span>
          <StatusBadge status={statusFromScore(score)} />
        </div>
      )}

      {sensor.status === "connected" && (
        <WifiSetup net={sensor.net} onSave={sensor.setupWifi} onForget={sensor.forgetWifi} />
      )}

      <p className="text-xs text-muted-foreground">
        {sensor.net.state === "ok"
          ? "The sensor is uploading over WiFi, so this page doesn't upload."
          : !sensor.configured
          ? "Supabase isn't configured (.env.local), so readings are shown live but not saved."
          : sync.error
            ? `Sync failed, will retry: ${sync.error}`
            : `${sync.pending} waiting to upload${sync.lastSyncedAt ? ` · last sync ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : ""}`}
      </p>
    </div>
  );
}
