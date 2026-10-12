"use client"

// Minimal Web Bluetooth link to the ESP32 for the real app (the /demo
// playground has its own, fuller copy since that folder is sealed).
// Firmware: esp32/test/src/main.cpp, Nordic UART Service, newline-terminated text:
//   "back,neck,alert[,backRoll,neckRoll]" at ~20 Hz, anything else is a log line.
//   "PEERS:n" = how many phones/laptops are connected to the sensor right now.

export const ESP32_NAME = "PostureMonitor"
// Web Bluetooth only accepts lowercase UUIDs.
const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // phone → ESP32
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // ESP32 → phone

export type SensorSample = {
  /** Date.now() when it arrived */
  at: number
  /** Back pitch, degrees from calibration, + = forward */
  back: number
  neck: number
  /** Side lean, + = right (0 with older firmware) */
  backRoll: number
  neckRoll: number
  /** true while the slouch alert is active (slouching past the time limit), even if the buzzer is muted */
  alert: boolean
}

type BleCharacteristic = EventTarget & {
  value?: DataView
  startNotifications(): Promise<BleCharacteristic>
  writeValue(value: BufferSource): Promise<void>
}
type BleDevice = EventTarget & {
  name?: string
  gatt?: {
    connect(): Promise<{ getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BleCharacteristic> }> }>
    disconnect(): void
  }
}
type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice(options: { filters: ({ services: string[] } | { name: string })[]; optionalServices?: string[] }): Promise<BleDevice>
  }
}

export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator

const NUM = "(-?\\d+(?:\\.\\d+)?)"
const SAMPLE_RE = new RegExp(`^${NUM},${NUM},([01])(?:,${NUM},${NUM})?$`)

export function parseSample(line: string, at = Date.now()): SensorSample | null {
  const m = SAMPLE_RE.exec(line)
  if (!m) return null
  return {
    at,
    back: Number(m[1]),
    neck: Number(m[2]),
    alert: m[3] === "1",
    backRoll: m[4] ? Number(m[4]) : 0,
    neckRoll: m[5] ? Number(m[5]) : 0,
  }
}

/** "PEERS:2" → 2 */
export function parsePeers(line: string): number | null {
  const m = /^PEERS:(\d+)$/.exec(line)
  return m ? Number(m[1]) : null
}

// Only one tab per browser should hold the sensor. A tab about to connect tells the
// others to let go (app/demo listens on the same channel name).
const TABS_CHANNEL = "reallign-ble"

export function releaseOtherTabs() {
  if (typeof BroadcastChannel === "undefined") return
  const channel = new BroadcastChannel(TABS_CHANNEL)
  channel.postMessage("release")
  channel.close()
}

export type SensorConnection = {
  name: string
  /** Sends one command. Writes are queued; GATT allows one at a time. */
  send(command: string): Promise<void>
  disconnect(): void
}

// Chrome often drops a fresh GATT connection ("GATT Server is disconnected.
// Cannot retrieve services"); a clean disconnect and another try usually works.
const CONNECT_ATTEMPTS = 4

// ── Pairing steps, shown on /device so it's clear where a connection stops ──
export type PairStep = "browser" | "pick" | "link" | "service" | "stream" | "data"
export type StepState = "waiting" | "active" | "done" | "failed"

export const PAIR_STEPS: { id: PairStep; label: string; hint: string }[] = [
  {
    id: "browser",
    label: "Bluetooth available",
    hint: "Use Chrome or Edge on localhost or https (Bluefy on iPhone), and turn Bluetooth on.",
  },
  {
    id: "pick",
    label: "Sensor chosen",
    hint: "Pick PostureMonitor in the popup. Not listed? Power the sensor, or disconnect it from other phones and laptops.",
  },
  {
    id: "link",
    label: "Bluetooth link",
    hint: "The sensor dropped the link. Move closer, close other tabs using it, and check the Serial Monitor for a reboot (rst:, Brownout, Guru Meditation).",
  },
  {
    id: "service",
    label: "Sensor service found",
    hint: "Connected, but this isn't reallign firmware, or the sensor rebooted. Reflash main.cpp and try again.",
  },
  {
    id: "stream",
    label: "Data channel open",
    hint: "Couldn't subscribe to the sensor's data. Turn the sensor off and on, then try again.",
  },
  {
    id: "data",
    label: "Receiving posture data",
    hint: "Connected, but no readings yet. It may be calibrating (sit straight for ~8 s), or a sensor chip isn't detected (see Serial Monitor).",
  },
]

export type PairProgress = { step: PairStep; state: StepState; detail?: string }

/** Opens the browser's device picker. Resolves null if the user cancels. */
export async function connectSensor(handlers: {
  onSample(sample: SensorSample): void
  onLine?(line: string): void
  onDisconnect(): void
  onProgress?(progress: PairProgress): void
}): Promise<SensorConnection | null> {
  const progress = (step: PairStep, state: StepState, detail?: string) => handlers.onProgress?.({ step, state, detail })

  progress("browser", "active")
  const bluetooth = (navigator as BluetoothNavigator).bluetooth
  if (!bluetooth) {
    progress("browser", "failed")
    throw new Error("This browser has no Web Bluetooth. Use Chrome/Edge, or Bluefy on iPhone.")
  }
  progress("browser", "done")
  // Other tabs disconnect while the user is picking the device.
  releaseOtherTabs()

  progress("pick", "active")
  let device: BleDevice
  try {
    device = await bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE] }, { name: ESP32_NAME }],
      optionalServices: [NUS_SERVICE],
    })
  } catch {
    progress("pick", "waiting")
    return null // picker closed
  }
  progress("pick", "done", device.name)

  // Notifications arrive in 20-byte chunks; rebuild whole lines.
  const decoder = new TextDecoder()
  let buffer = ""
  const onChunk = (value: DataView) => {
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      const trimmed = line.trim()
      const sample = parseSample(trimmed)
      if (sample) handlers.onSample(sample)
      else if (trimmed) handlers.onLine?.(trimmed)
    }
  }

  // The whole GATT setup is retried: the link can drop at any of these steps.
  let rx: BleCharacteristic | null = null
  let lastError: Error | null = null
  let failedStep: PairStep = "link"
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS && !rx; attempt++) {
    const tries = attempt > 1 ? `try ${attempt} of ${CONNECT_ATTEMPTS}` : undefined
    let step: PairStep = "link"
    try {
      progress("link", "active", tries)
      const server = await device.gatt!.connect()
      progress("link", "done", tries)

      step = "service"
      progress("service", "active")
      const service = await server.getPrimaryService(NUS_SERVICE)
      const tx = await service.getCharacteristic(NUS_TX)
      const rxChar = await service.getCharacteristic(NUS_RX)
      progress("service", "done")

      step = "stream"
      progress("stream", "active")
      tx.addEventListener("characteristicvaluechanged", () => tx.value && onChunk(tx.value))
      await tx.startNotifications()
      progress("stream", "done")
      rx = rxChar
    } catch (err) {
      lastError = err as Error
      failedStep = step
      // Start the next try from a clean state.
      device.gatt?.disconnect()
      if (attempt < CONNECT_ATTEMPTS) {
        progress(step, "active", `dropped, retrying (${attempt + 1} of ${CONNECT_ATTEMPTS})`)
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt))
      }
    }
  }
  if (!rx) {
    progress(failedStep, "failed", lastError?.message)
    throw new Error(`${lastError?.message ?? "Couldn't connect."} Tried ${CONNECT_ATTEMPTS} times.`)
  }
  const rxReady = rx
  progress("data", "active")
  // Only now: a drop during the retries above isn't a session ending.
  const tabs = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(TABS_CHANNEL)
  if (tabs) tabs.onmessage = (e) => e.data === "release" && device.gatt?.disconnect()
  device.addEventListener("gattserverdisconnected", () => {
    tabs?.close()
    handlers.onDisconnect()
  })

  // writeValue (with response) so each chunk is acknowledged before the next one.
  let queue = Promise.resolve()
  const send = (command: string) => {
    const result = queue.then(() => rxReady.writeValue(new TextEncoder().encode(command)))
    queue = result.catch(() => {})
    return result
  }

  return { name: device.name ?? ESP32_NAME, send, disconnect: () => device.gatt?.disconnect() }
}
