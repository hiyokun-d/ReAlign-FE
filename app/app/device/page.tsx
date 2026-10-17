// Device — PLACEHOLDER. Owner: frontend team (UI) + backend/IoT (connection logic).
// The ESP32 talks Bluetooth to this page; ConnectButton syncs it to Supabase.

import { ConnectButton } from "@/app/device/connect-button";
import { WatchQr } from "@/app/device/watch-qr";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getDevice } from "@/lib/data";

export default async function DevicePage() {
  const device = await getDevice();

  return (
    <FadeIn className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Device</h1>
        <p className="text-sm text-muted-foreground">
          Watching from another phone or laptop? Don&apos;t open this page there: it has its own empty data.
          Scan the QR code below instead.
        </p>
      </div>

      {!device ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No sensor yet</CardTitle>
            <CardDescription>Turn on your reallign sensor and connect it over Bluetooth.</CardDescription>
          </CardHeader>
          <CardFooter>
            <ConnectButton />
          </CardFooter>
        </Card>
      ) : (

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {device.name}
            <Badge variant={device.connected ? "default" : "outline"}>
              {device.connected ? "Connected" : "Disconnected"}
            </Badge>
          </CardTitle>
          <CardDescription>ID {device.id} · firmware {device.firmwareVersion}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span>Battery</span>
            <span className="tabular-nums">{device.battery}%</span>
          </div>
          <Progress value={device.battery} />
          <Separator />
          <p className="text-xs text-muted-foreground">
            Last seen {new Date(device.lastSeenAt).toLocaleString()}
          </p>
        </CardContent>
        <CardFooter>
          <ConnectButton />
        </CardFooter>
      </Card>
      )}

      <WatchQr />
    </FadeIn>
  );
}
