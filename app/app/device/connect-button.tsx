"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/posture/status-badge";
import { PairingSteps } from "@/app/device/pairing-steps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { READING_INTERVALS } from "@/lib/esp32/aggregate";
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

      {(sensor.status !== "idle" || Object.values(sensor.pairing).some((s) => s.state !== "waiting")) && (
        <PairingSteps pairing={sensor.pairing} />
      )}

      {latest && score !== null && (
        <div className="flex items-center justify-between text-sm tabular-nums">
          <span>
            back {latest.back.toFixed(1)}° · neck {latest.neck.toFixed(1)}° · score {score}
          </span>
          <StatusBadge status={statusFromScore(score)} />
        </div>
      )}

      <label className="flex items-center justify-between gap-2 text-sm">
        <span>Send a reading every</span>
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={sensor.intervalSec}
          onChange={(e) => sensor.setIntervalSec(Number(e.target.value))}
        >
          {READING_INTERVALS.map((s) => (
            <option key={s} value={s}>
              {s} s
            </option>
          ))}
        </select>
      </label>

      {sensor.status === "connected" && (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Operator</span>
            <span className="text-xs text-muted-foreground">
              {sensor.peers === null
                ? "Other phones or laptops may be connected to the sensor."
                : sensor.peers <= 1
                  ? "Only you are connected to the sensor."
                  : `${sensor.peers - 1} other device${sensor.peers > 2 ? "s" : ""} connected to the sensor.`}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={sensor.peers !== null && sensor.peers <= 1}
            onClick={() => {
              sensor.kickOthers();
              toast.success("Disconnected everyone else");
            }}
          >
            Disconnect everyone else
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {!sensor.configured
          ? "Supabase isn't configured (.env.local), so readings are shown live but not saved."
          : sync.error
            ? `Sync failed, will retry: ${sync.error}`
            : `${sync.pending} waiting to upload${sync.lastSyncedAt ? ` · last sync ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : ""}`}
      </p>
    </div>
  );
}
