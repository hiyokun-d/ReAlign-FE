// Turns the ~20 Hz sensor stream into one row per interval (what we store in
// posture_readings, default every 5 s) plus running session stats. Pure, so it's easy to test.

import type { SensorSample } from "@/lib/esp32/ble"
import { scoreFromAngles } from "@/lib/posture"

/** Seconds between posture_readings rows. Same choices as the firmware's WI= command. */
export const READING_INTERVALS = [1, 5, 10, 30, 60] as const
export const DEFAULT_READING_INTERVAL = 5

export type IntervalRow = {
  start: string // ISO, start of the interval
  pitch: number
  roll: number
  neck_pitch: number
  score: number
  samples: number
}

export type SessionStats = { slouchSeconds: number }

// Gaps longer than this (BLE hiccup, calibration) don't count as slouch time.
const MAX_GAP_MS = 1000

export class IntervalAggregator {
  private bucket = -1
  private n = 0
  private back = 0
  private roll = 0
  private neck = 0
  private score = 0
  private motorWasOn = false
  private lastAt = 0
  private slouchMs = 0

  constructor(private intervalMs: number) {}

  /** Returns the finished interval when a sample crosses into a new one. */
  add(s: SensorSample): IntervalRow | null {
    const bucket = Math.floor(s.at / this.intervalMs)
    const done = bucket !== this.bucket && this.n > 0 ? this.flush() : null
    this.bucket = bucket

    this.n++
    this.back += s.back
    this.roll += s.backRoll
    this.neck += s.neck
    this.score += scoreFromAngles(s.back, s.backRoll)
    // Slouch time = how long the firmware kept the motor buzzing.
    if (this.motorWasOn && this.lastAt) this.slouchMs += Math.min(s.at - this.lastAt, MAX_GAP_MS)
    this.motorWasOn = s.motor
    this.lastAt = s.at
    return done
  }

  /** Closes the current (partial) interval, e.g. on disconnect. */
  flush(): IntervalRow | null {
    if (this.n === 0) return null
    const round1 = (x: number) => Math.round((x / this.n) * 10) / 10
    const row: IntervalRow = {
      start: new Date(this.bucket * this.intervalMs).toISOString(),
      pitch: round1(this.back),
      roll: round1(this.roll),
      neck_pitch: round1(this.neck),
      score: Math.round(this.score / this.n),
      samples: this.n,
    }
    this.n = this.back = this.roll = this.neck = this.score = 0
    return row
  }

  stats(): SessionStats {
    return { slouchSeconds: Math.round(this.slouchMs / 1000) }
  }
}
