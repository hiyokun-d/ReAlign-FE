"use client";

import { CircleCheckIcon, CircleIcon, CircleXIcon, Loader2Icon } from "lucide-react";
import { PAIR_STEPS, type StepState } from "@/lib/esp32/ble";
import type { PairingState } from "@/lib/esp32/use-sensor-sync";
import { cn } from "@/lib/utils";

// Live checklist of the Bluetooth pairing, so it's obvious where it stops.
// All green = good to go.

const ICONS: Record<StepState, typeof CircleIcon> = {
  waiting: CircleIcon,
  active: Loader2Icon,
  done: CircleCheckIcon,
  failed: CircleXIcon,
};

export function PairingSteps({ pairing }: { pairing: PairingState }) {
  const allDone = PAIR_STEPS.every((s) => pairing[s.id].state === "done");

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <span className="text-sm font-medium">{allDone ? "Good to go" : "Pairing"}</span>
      <ol className="flex flex-col gap-1.5">
        {PAIR_STEPS.map((step) => {
          const { state, detail } = pairing[step.id];
          const Icon = ICONS[state];
          return (
            <li key={step.id} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-sm">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    state === "waiting" && "text-muted-foreground/50",
                    state === "active" && "animate-spin text-muted-foreground",
                    state === "done" && "text-primary",
                    state === "failed" && "text-destructive"
                  )}
                />
                <span className={cn(state === "waiting" && "text-muted-foreground")}>{step.label}</span>
                {detail && <span className="truncate text-xs text-muted-foreground">· {detail}</span>}
              </div>
              {state === "failed" && <p className="ml-6 text-xs text-destructive">{step.hint}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
