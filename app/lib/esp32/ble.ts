"use client"

// Minimal Web Bluetooth link to the ESP32 for the real app (the /demo
// playground has its own, fuller copy since that folder is sealed).
// Firmware: esp32/test/src/main.cpp, Nordic UART Service, newline-terminated text:
//   "back,neck,motor[,backRoll,neckRoll]" at ~20 Hz, anything else is a log line.
//   "PEERS:n" = how many phones/laptops are connected to the sensor right now.
//   "NET:..." lines report the ESP32's own WiFi upload (WiFi upload section of esp32/test/src/main.cpp).

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
  /** true while the vibration motor is buzzing (= slouch alert) */
  motor: boolean
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
    motor: m[3] === "1",
    backRoll: m[4] ? Number(m[4]) : 0,
    neckRoll: m[5] ? Number(m[5]) : 0,
  }
}

/** The ESP32's own WiFi upload state, from its "NET:..." lines. */
export type NetStatus =
  | { state: "unknown" }
  | { state: "off" }
  | { state: "connecting" }
  | { state: "ok"; ip: string }
  | { state: "fail"; reason: string }

export function parseNet(line: string): NetStatus | null {
  if (!line.startsWith("NET:")) return null
  const [state, ...rest] = line.slice(4).split(" ")
  if (state === "OFF") return { state: "off" }
  if (state === "CONNECTING") return { state: "connecting" }
  if (state === "OK") return { state: "ok", ip: rest[0] ?? "" }
  if (state === "FAIL") return { state: "fail", reason: rest.join(" ") }
  return null
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

// Chrome often drops the very first GATT connection ("GATT Server is disconnected.
// Cannot retrieve services"); trying again almost always works.
const CONNECT_ATTEMPTS = 3

// One BLE write is 20 bytes with the default MTU; the firmware reassembles "W?=" + "W?+" chunks.
const CHUNK = 17

export type WifiConfig = { ssid: string; password: string; ingestUrl: string; token: string }

/** Sends WiFi + upload settings to the ESP32 over BLE. It saves them to flash and connects. */
export async function sendWifiConfig(conn: SensorConnection, cfg: WifiConfig) {
  const fields: [string, string][] = [
    ["S", cfg.ssid],
    ["P", cfg.password],
    ["U", cfg.ingestUrl],
    ["T", cfg.token],
  ]
  for (const [key, value] of fields) {
    const bytes = new TextEncoder().encode(value)
    if (bytes.length !== value.length) throw new Error("Only plain ASCII is supported in WiFi names, passwords and URLs.")
    for (let i = 0; i === 0 || i < value.length; i += CHUNK) {
      await conn.send(`W${key}${i === 0 ? "=" : "+"}${value.slice(i, i + CHUNK)}`)
    }
  }
  await conn.send("WIFI")
}

/** Opens the browser's device picker. Resolves null if the user cancels. */
export async function connectSensor(handlers: {
  onSample(sample: SensorSample): void
  onLine?(line: string): void
  onDisconnect(): void
}): Promise<SensorConnection | null> {
  const bluetooth = (navigator as BluetoothNavigator).bluetooth
  if (!bluetooth) throw new Error("This browser has no Web Bluetooth. Use Chrome/Edge, or Bluefy on iPhone.")
  // Other tabs disconnect while the user is picking the device.
  releaseOtherTabs()

  let device: BleDevice
  try {
    device = await bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE] }, { name: ESP32_NAME }],
      optionalServices: [NUS_SERVICE],
    })
  } catch {
    return null // picker closed
  }

  let rx: BleCharacteristic
  try {
    const service = await connectService(device)
    const tx = await service.getCharacteristic(NUS_TX)
    rx = await service.getCharacteristic(NUS_RX)

    // Notifications arrive in 20-byte chunks; rebuild whole lines.
    const decoder = new TextDecoder()
    let buffer = ""
    tx.addEventListener("characteristicvaluechanged", () => {
      if (!tx.value) return
      buffer += decoder.decode(tx.value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        const trimmed = line.trim()
        const sample = parseSample(trimmed)
        if (sample) handlers.onSample(sample)
        else if (trimmed) handlers.onLine?.(trimmed)
      }
    })
    await tx.startNotifications()
  } catch (err) {
    device.gatt?.disconnect()
    throw new Error(
      `${(err as Error).message} Close other tabs using the sensor (like /demo), make sure it's powered, and try again.`
    )
  }
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
    const result = queue.then(() => rx.writeValue(new TextEncoder().encode(command)))
    queue = result.catch(() => {})
    return result
  }

  return { name: device.name ?? ESP32_NAME, send, disconnect: () => device.gatt?.disconnect() }
}

async function connectService(device: BleDevice) {
  for (let attempt = 1; ; attempt++) {
    try {
      const server = await device.gatt!.connect()
      return await server.getPrimaryService(NUS_SERVICE)
    } catch (err) {
      if (attempt >= CONNECT_ATTEMPTS) throw err
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
    }
  }
}
