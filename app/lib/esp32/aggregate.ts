// Turns the ~20 Hz sensor stream into one row per minute (what we store in
// posture_readings) plus running session stats. Pure, so it's easy to test.

import type { SensorSample } from "@/lib/esp32/ble"
import { scoreFromAngles, statusFromScore } from "@/lib/posture"

const MINUTE = 60_000

export type MinuteRow = {
  minute: string // ISO, start of the minute
  pitch: number
  roll: number
  neck_pitch: number
  score: number
  slouch_count: number
  samples: number
}

export type SessionStats = { averageScore: number; slouchCount: number; goodMinutes: number; slouchSeconds: number }

// Gaps longer than this (BLE hiccup, calibration) don't count as slouch time.
const MAX_GAP_MS = 1000

export class MinuteAggregator {
  private bucket = -1
  private n = 0
  private back = 0
  private roll = 0
  private neck = 0
  private score = 0
  private slouches = 0
  private motorWasOn = false
  private lastAt = 0
  private slouchMs = 0

  private minutes = 0
  private scoreTotal = 0
  private slouchTotal = 0
  private goodMinutes = 0

  /** Returns the finished minute when a sample crosses into a new one. */
  add(s: SensorSample): MinuteRow | null {
    const bucket = Math.floor(s.at / MINUTE)
    const done = bucket !== this.bucket && this.n > 0 ? this.flush() : null
    this.bucket = bucket

    this.n++
    this.back += s.back
    this.roll += s.backRoll
    this.neck += s.neck
    this.score += scoreFromAngles(s.back, s.backRoll)
    // A slouch = the motor turning on, not every sample it stays on.
    if (s.motor && !this.motorWasOn) this.slouches++
    // Slouch time = how long the firmware kept the motor buzzing.
    if (this.motorWasOn && this.lastAt) this.slouchMs += Math.min(s.at - this.lastAt, MAX_GAP_MS)
    this.motorWasOn = s.motor
    this.lastAt = s.at
    return done
  }

  /** Closes the current (partial) minute, e.g. on disconnect. */
  flush(): MinuteRow | null {
    if (this.n === 0) return null
    const round1 = (x: number) => Math.round((x / this.n) * 10) / 10
    const row: MinuteRow = {
      minute: new Date(this.bucket * MINUTE).toISOString(),
      pitch: round1(this.back),
      roll: round1(this.roll),
      neck_pitch: round1(this.neck),
      score: Math.round(this.score / this.n),
      slouch_count: this.slouches,
      samples: this.n,
    }
    this.minutes++
    this.scoreTotal += row.score
    this.slouchTotal += row.slouch_count
    if (statusFromScore(row.score) === "good") this.goodMinutes++
    this.n = this.back = this.roll = this.neck = this.score = this.slouches = 0
    return row
  }

  stats(): SessionStats {
    return {
      averageScore: this.minutes ? Math.round(this.scoreTotal / this.minutes) : 0,
      slouchCount: this.slouchTotal,
      goodMinutes: this.goodMinutes,
      slouchSeconds: Math.round(this.slouchMs / 1000),
    }
  }
}
