# reallign: Frontend Guide

Welcome! This is the guide for the frontend team working on the **reallign** web app.

- **New here?** Read sections 1–5 before your first PR (about 15 minutes).
- **Looking something up?** Use the contents below.
- **Using an AI agent?** Jump to [section 15](#15-working-with-ai-agents). There are prompts you can paste.

## Contents

1. [What we're building](#1-what-were-building)
2. [Getting started](#2-getting-started)
3. [The pages](#3-the-pages)
4. [Project structure](#4-project-structure)
5. [The golden rule: data comes from `lib/data.ts`](#5-the-golden-rule-data-comes-from-libdatats)
6. [Data functions: reference](#6-data-functions-reference)
7. [Data types: reference](#7-data-types-reference)
8. [Helpers](#8-helpers)
9. [Components you can reuse](#9-components-you-can-reuse)
10. [The sensor on a page: `useSensorSync`](#10-the-sensor-on-a-page-usesensorsync)
11. [Files to leave alone](#11-files-to-leave-alone)
12. [shadcn/ui (on Base UI)](#12-shadcnui-on-base-ui)
13. [Motion (animations)](#13-motion-animations)
14. [Styling, conventions and page states](#14-styling-conventions-and-page-states)
15. [Working with AI agents](#15-working-with-ai-agents)
16. [Common problems](#16-common-problems)
17. [Before you open a PR](#17-before-you-open-a-pr)
18. [What's next](#18-whats-next)
19. [Glossary](#19-glossary)

---

## 1. What we're building

reallign helps people fix their posture. A small **ESP32** sensor worn on the back and neck
measures how you're sitting. When you slouch for too long, it raises a slouch alert (and beeps,
if the buzzer is turned on). Two LEDs on the sensor show the Bluetooth status. The web app shows:

- your posture score **live**,
- your **history** (sessions and daily stats),
- the **sensor's status**, and a QR code so **other people can watch live**.

### How data moves

```
 ESP32 sensor ──Bluetooth──▶ Main device (laptop/phone with /device open)
 (20 readings/s)                 │
                                 ├──▶ Supabase database: 1 reading every 5 s (configurable)
                                 │        └──▶ Dashboard, History, Session pages read from here
                                 │
                                 └──▶ Live channel: ~10 samples/s, not saved
                                          └──▶ /watch page on other devices (via QR link)
```

Key facts:

- **Bluetooth only.** The sensor has no WiFi. (WiFi and Bluetooth share one radio on the ESP32,
  and WiFi kept breaking Bluetooth connections.)
- The **main device** is whichever laptop or phone has `/device` open and connected.
  It does all the saving. If it closes the page, recording stops.
- **No login yet.** Each browser automatically gets its own anonymous account. That's why
  a different browser sees an empty app (see [Common problems](#16-common-problems)).
- **Watching from another device** works through the QR code on `/device`, which opens `/watch`.

### Who owns what

| Part | Folder | Owner |
| --- | --- | --- |
| Sensor firmware | `../esp32/test/src/main.cpp` | IoT |
| Data, Bluetooth, Supabase, API routes | `lib/data.ts`, `lib/esp32/`, `lib/supabase/`, `app/api/` | Backend |
| Pages, components, styling, animation | `app/`, `components/` | **Frontend (you)** |

---

## 2. Getting started

We use **Bun** (not npm or yarn).

```bash
cd app
bun install
bun dev            # opens on http://localhost:3000
```

### Mock mode vs. real mode

The app runs in one of two modes, depending on whether `app/.env.local` exists:

| | **Mock mode** (no `.env.local`) | **Real mode** (with `.env.local`) |
| --- | --- | --- |
| Data | Dummy data from `lib/mock-data.ts`, always filled | Your real Supabase data (empty until you record) |
| Sensor needed? | No | Only to record new data |
| Best for | Building and styling pages | Testing with the real sensor |

**Most frontend work is easiest in mock mode.** Every page shows realistic data right away.

To use real mode, ask the backend lead for the `.env.local` file and put it in `app/`.
**Never commit it.** It holds secret keys, and git already ignores it. The variable names are
listed in `.env.example`.

### Before you push

```bash
bun run lint
bun run build
```

Both must finish without errors.

---

## 3. The pages

| URL | File | What it shows | Status |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Dashboard: current score, last 60 minutes, today's stats | Placeholder design |
| `/history` | `app/history/page.tsx` | Session list (tab 1) and last 7 days (tab 2). Each session is clickable | Placeholder design |
| `/history/[id]` | `app/history/[id]/page.tsx` | One session: duration, average score, slouch time, full log of readings | Placeholder design |
| `/device` | `app/device/page.tsx` | Connect the sensor, pairing checklist, reading interval, Operator controls, QR to watch | Working, needs design |
| `/watch?t=…` | `app/watch/page.tsx` + `live-view.tsx` | Live view for other devices (opened from the QR code) | Working, needs design |
| `/demo` | `app/demo/` | Private playground (games, raw sensor tests). **Sealed: don't import from it** | Lab only |

"Placeholder design" means the data and logic work, but the look is a first draft.
**Redesigning these is your main job.**

---

## 4. Project structure

```
app/
├── app/                          # Routes (Next.js App Router)
│   ├── layout.tsx                # Nav + <Toaster /> on every page
│   ├── loading.tsx               # Skeleton shown while a page loads
│   ├── page.tsx                  # /              Dashboard
│   ├── history/page.tsx          # /history       Sessions + last 7 days
│   ├── history/[id]/page.tsx     # /history/:id   One session's log
│   ├── device/
│   │   ├── page.tsx              # /device        Sensor page
│   │   ├── connect-button.tsx    #   Connect, interval, Operator, sync status (uses useSensorSync)
│   │   ├── pairing-steps.tsx     #   Pairing checklist
│   │   └── watch-qr.tsx          #   "Watch on another device" QR card
│   ├── watch/
│   │   ├── page.tsx              # /watch         Checks the link
│   │   └── live-view.tsx         #   Live score + chart for viewers
│   ├── api/                      # Server routes (backend owns these)
│   └── demo/                     # Sealed playground
├── components/
│   ├── ui/                       # shadcn components (generated, see section 12)
│   ├── motion/fade-in.tsx        # FadeIn / Stagger / StaggerItem
│   ├── posture/                  # ScoreRing, StatusBadge, ReadingsBarChart
│   └── layout/site-nav.tsx       # Top navigation
└── lib/
    ├── data.ts                   # ⭐ The ONLY place pages get data from
    ├── types.ts                  # Data shapes (PostureReading, PostureSession, …)
    ├── mock-data.ts              # Dummy data (only data.ts may import it)
    ├── posture.ts                # Score and status helpers
    ├── format.ts                 # Duration helpers
    ├── utils.ts                  # cn() for class names
    ├── public-url.ts             # Is this URL localhost?
    ├── esp32/                    # Bluetooth, syncing, live broadcast (backend)
    ├── supabase/                 # Database clients (backend)
    └── watch-token.ts            # Signed watch links (backend)
```

---

## 5. The golden rule: data comes from `lib/data.ts`

**Pages get data only by calling functions from `lib/data.ts`.**

```tsx
// ✅ Do
import { getLatestReading } from "@/lib/data"
const reading = await getLatestReading()

// ❌ Don't
import { mockReadings } from "@/lib/mock-data"          // skips real data
import { getSupabaseServer } from "@/lib/supabase/server" // database code in a page
```

Why: the same function returns dummy data in mock mode and real data in real mode.
Your page works the same either way.

### Call them from server components

The functions in `lib/data.ts` run **on the server**. They read the user's login cookie.

- Call them in **pages** (`page.tsx`), which are server components by default.
- **Don't import `lib/data.ts` in a `"use client"` file.** It fails to build.
- If a client component needs the data, fetch it in the page and **pass it as a prop**:

```tsx
// app/page.tsx (server component)
import { getRecentReadings } from "@/lib/data"
import { TrendChart } from "@/components/posture/trend-chart"

export default async function DashboardPage() {
  const readings = await getRecentReadings(60)
  return <TrendChart readings={readings} />   // client component gets data as a prop
}
```

### Need data that doesn't exist yet?

1. Add a function to `lib/data.ts` that returns **mock data** (follow the pattern of the others).
2. Add its type to `lib/types.ts` if it needs a new shape.
3. Tell the backend lead so they can implement the real version.

---

## 6. Data functions: reference

All functions are `async`. In mock mode they wait about 300 ms so you can see loading states.

### `getLatestReading()`

The newest reading. Use it for "right now" displays.

```ts
getLatestReading(): Promise<PostureReading | null>
```

- Returns `null` when there's no data yet. **Always handle `null`** with an empty state.
- In real mode it's at most about 5 seconds old while the sensor is recording.

### `getRecentReadings(limit = 60)`

One averaged reading **per minute** for the last `limit` minutes, oldest first.
Use it for charts.

```ts
getRecentReadings(limit?: number): Promise<PostureReading[]>
```

- Minutes without data are skipped, so the array can be shorter than `limit`, or empty.

### `getSessions()`

The 20 most recent sessions, newest first. A session starts each time the sensor connects.

```ts
getSessions(): Promise<PostureSession[]>
```

- `endedAt === null` means the session is **live right now** (a reading arrived in the last 30 s).
- Use `formatDuration(sessionSeconds(s.startedAt, s.endedAt))` to show how long it lasted.

### `getSessionDetail(id)`

One session plus **every reading** in it, oldest first. Powers `/history/[id]`.

```ts
getSessionDetail(id: string): Promise<SessionDetail | null>
```

- Returns `null` if the session doesn't exist. Call `notFound()` from `next/navigation` in that case.
- Readings here are **not** averaged (one per 5 s by default), so a long session can have thousands.

### `getDailySummaries()`

Stats per day for the last 7 days, oldest first. Use it for weekly charts.

```ts
getDailySummaries(): Promise<DailySummary[]>
```

- In real mode, only days **with data** are included (0–7 items). In mock mode there are always 7.
- Days are in **UTC**.

### `getDevice()`

The sensor's status.

```ts
getDevice(): Promise<Device | null>
```

- Returns `null` if the sensor has never sent data.
- `connected` means "data arrived in the last 2 minutes". The server can't see Bluetooth directly.
- `battery` is always `0` and `firmwareVersion` is `"unknown"` in real mode, because the sensor
  doesn't report them yet. **Don't design around the battery level for now.**

---

## 7. Data types: reference

All in `lib/types.ts`.

### `PostureReading`: one reading

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Unique id (use as React `key`) |
| `timestamp` | `string` | ISO date, e.g. `"2026-10-12T08:30:00.000Z"` |
| `pitch` | `number` | Back lean forward/backward in degrees. 0 = upright, + = forward |
| `roll` | `number` | Side lean in degrees. **Always 0 in real mode** (not stored yet) |
| `score` | `number` | 0–100, **higher is better** |
| `status` | `PostureStatus` | `"good"` (≥ 75), `"warning"` (50–74), `"bad"` (< 50) |

### `PostureSession`: one tracking period

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Session id (used in `/history/[id]`) |
| `startedAt` | `string` | ISO date |
| `endedAt` | `string \| null` | ISO date, or `null` while live |
| `averageScore` | `number` | 0–100 |
| `slouchCount` | `number` | **Minutes** spent slouching (status `bad`) |
| `goodMinutes` | `number` | Minutes in good posture |
| `slouchSeconds` | `number` | How long the slouch alert was on (counted even when the buzzer is muted) |

### `SessionDetail`

`{ session: PostureSession; readings: PostureReading[] }`

### `DailySummary`: one day

| Field | Type | Meaning |
| --- | --- | --- |
| `date` | `string` | `"YYYY-MM-DD"` (UTC) |
| `averageScore` | `number` | 0–100 |
| `slouchCount` | `number` | Minutes slouching that day |
| `trackedMinutes` | `number` | Minutes with any data |

### `Device`

| Field | Type | Meaning |
| --- | --- | --- |
| `id`, `name` | `string` | `"esp32"`, `"Reallign Sensor"` |
| `connected` | `boolean` | Data in the last 2 minutes |
| `battery` | `number` | 0–100 (not real yet) |
| `firmwareVersion` | `string` | Not real yet |
| `lastSeenAt` | `string` | ISO date of the last reading |

### `PostureStatus`

`"good" | "warning" | "bad"`

---

## 8. Helpers

| Import | What it does | Example |
| --- | --- | --- |
| `statusFromScore(score)` from `@/lib/posture` | Score → `"good"` / `"warning"` / `"bad"` | `statusFromScore(80)` → `"good"` |
| `scoreFromAngles(pitch, roll)` from `@/lib/posture` | Angles → score 0–100 | `scoreFromAngles(10, 0)` → `82` |
| `formatDuration(seconds)` from `@/lib/format` | `"45 s"`, `"12 min"`, `"1 h 05 min"` | `formatDuration(3900)` → `"1 h 05 min"` |
| `sessionSeconds(startedAt, endedAt)` from `@/lib/format` | Length of a session in seconds (live sessions count up to now) | |
| `cn(...classes)` from `@/lib/utils` | Merges Tailwind classes safely | `cn("p-4", active && "bg-muted")` |

**Use these instead of writing your own.** That way, if the score rules change, they change everywhere.

---

## 9. Components you can reuse

### Posture widgets (`components/posture/`)

| Component | Props | What it looks like |
| --- | --- | --- |
| `<ScoreRing score={72} />` | `score: number` | Ring that fills up, number counts up |
| `<StatusBadge status="good" />` | `status: PostureStatus` | Coloured badge, e.g. "Good posture" |
| `<ReadingsBarChart readings={…} />` | `readings: PostureReading[]` | One bar per reading, height = score |

`ReadingsBarChart` is a placeholder made of plain divs. Replace it with a real chart
(for example shadcn's `chart`) **but keep the same props**, so pages don't need changes.

### Animation wrappers (`components/motion/fade-in.tsx`)

`<FadeIn>`, `<Stagger>`, `<StaggerItem>`: see [section 13](#13-motion-animations).

### Device page pieces (`app/device/`)

| File | What it is | Can you restyle it? |
| --- | --- | --- |
| `connect-button.tsx` | Connect button, interval picker, Operator box, sync status | **Yes**, change the look freely. Keep the `sensor.*` calls |
| `pairing-steps.tsx` | Checklist of pairing steps | **Yes** |
| `watch-qr.tsx` | QR card for watching on another device | **Yes**, keep the `fetch` and token logic |

### Live view (`app/watch/live-view.tsx`)

The page viewers see after scanning the QR. **Restyle it freely**, but keep the two
`useEffect` blocks: one opens the stored-readings stream, the other the instant channel.

---

## 10. The sensor on a page: `useSensorSync`

`useSensorSync` (in `lib/esp32/use-sensor-sync.ts`) is the hook that connects to the sensor over
Bluetooth, saves readings, and broadcasts live. **It's already used in
`app/device/connect-button.tsx`.**

### Rules

1. **Use it in only one component**, and only on the Device page. Two copies would mean two
   Bluetooth connections fighting over one sensor.
2. It's a client hook: the file must start with `"use client"`.
3. `connect()` must run from a **click** (a browser security rule). Never call it automatically.
4. Bluetooth only works on **`http://localhost:3000`** or **https**, in **Chrome or Edge**
   (or the Bluefy app on iPhone). Not Safari or Firefox.

### What it gives you

```tsx
const sensor = useSensorSync({ onSynced: () => router.refresh() })
```

| Value | Type | Use it for |
| --- | --- | --- |
| `supported` | `boolean` | `false` → show "use Chrome/Edge" message |
| `configured` | `boolean` | `false` = mock mode, readings aren't saved |
| `status` | `"idle" \| "connecting" \| "connected" \| "error"` | Button label, colours |
| `error` | `string \| null` | Show under the button |
| `deviceName` | `string \| null` | e.g. `"PostureMonitor"` |
| `latest` | `SensorSample \| null` | **Live** reading, about 20 per second (see below) |
| `pairing` | `PairingState` | Pass to `<PairingSteps pairing={…} />` |
| `peers` | `number \| null` | Devices connected to the sensor (you included) |
| `kickOthers()` | function | Disconnects every other device |
| `intervalSec` / `setIntervalSec(n)` | `number` / function | Seconds between saved readings (1, 5, 10, 30, 60) |
| `sync` | `{ pending, lastSyncedAt, error }` | "3 waiting to upload · last sync 10:42" |
| `connect()` / `disconnect()` | functions | Buttons |
| `syncNow()` | function | Upload queued readings now |

`latest` (type `SensorSample`) has `back`, `neck` (pitch in degrees, + = leaning forward),
`backRoll`, `neckRoll` (side lean, + = right), `alert` (`true` while the slouch alert is on,
even if the buzzer is muted) and `at` (time).

To show a live score from it:

```tsx
import { scoreFromAngles, statusFromScore } from "@/lib/posture"

const score = sensor.latest ? scoreFromAngles(sensor.latest.back, sensor.latest.backRoll) : null
const status = score !== null ? statusFromScore(score) : null
```

### Pairing steps

`PAIR_STEPS` (in `lib/esp32/ble.ts`) lists the steps in order, each with a `label` and a
`hint` (help text for when it fails). Each step's state is `"waiting"`, `"active"`, `"done"`
or `"failed"`. All `"done"` means **good to go**.

---

## 11. Files to leave alone

These are owned by backend or IoT. **Don't edit them without asking the backend lead.**
(Reading them is fine.)

- `lib/data.ts` (except adding new **mock** functions, see section 5)
- `lib/esp32/*`, `lib/supabase/*`, `lib/watch-token.ts`
- `app/api/*`, `proxy.ts`, `next.config.ts`
- `.env.local`, `.env.example`
- `../esp32/*` (sensor firmware)
- `components/ui/*` can be edited, but prefer adding props or wrapping over rewriting

---

## 12. shadcn/ui (on Base UI)

shadcn isn't a package you import from npm. It **copies component source code into
`components/ui/`**. You own that code and can edit it.

### Adding a component

```bash
bunx --bun shadcn@latest add dialog
bunx --bun shadcn@latest add dropdown-menu tooltip   # several at once
```

Browse components at https://ui.shadcn.com/docs/components.

Already installed: `button`, `card`, `badge`, `progress`, `tabs`, `skeleton`, `separator`, `sonner`.

### ⚠️ We use Base UI, not Radix

Our shadcn setup (`base-nova` style) is built on **Base UI** (`@base-ui/react`), not Radix.
Most shadcn examples online use Radix. The main difference:

```tsx
// ❌ Radix style. Does NOT work here
<Button asChild><Link href="/history">History</Link></Button>

// ✅ Base UI style. Use the `render` prop
// (add nativeButton={false} when the rendered element isn't a <button>)
<Button render={<Link href="/history" />} nativeButton={false}>History</Button>
```

When you copy an example, set the shadcn docs page to **Base UI**.

### Using components

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader><CardTitle>Today</CardTitle></CardHeader>
  <CardContent>
    <Button variant="outline" size="sm">Details</Button>
  </CardContent>
</Card>
```

- Button variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes include `sm`.
- Badge variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`.
- Toasts (client components only): `import { toast } from "sonner"`, then `toast.success("Saved")`.

---

## 13. Motion (animations)

Framer Motion is now called **Motion**. Same API, new package name.

```tsx
import { motion, AnimatePresence } from "motion/react"   // ✅
import { motion } from "framer-motion"                   // ❌ old name, not installed
```

### Motion needs `"use client"`

Pages are **server components** and can't use `motion.div` directly. Two options:

**Option A: our wrappers** (easiest; they work inside server pages):

```tsx
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in"

<FadeIn delay={0.1}>
  <h1>Dashboard</h1>
</FadeIn>

<Stagger className="grid gap-4 md:grid-cols-3">
  <StaggerItem><Card>…</Card></StaggerItem>
  <StaggerItem><Card>…</Card></StaggerItem>   {/* appears 80 ms later */}
</Stagger>
```

**Option B: your own client component:**

```tsx
"use client"
import { motion } from "motion/react"

export function Pulse() {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  )
}
```

### Cheat sheet

| Want | Code |
| --- | --- |
| Animate on mount | `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` |
| Hover / tap | `whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}` |
| Animate when scrolled into view | `whileInView={{ opacity: 1 }} viewport={{ once: true }}` |
| Animate removal | Wrap in `<AnimatePresence>` and add `exit={{ opacity: 0 }}` |
| Slide an element between spots | Same `layoutId` on both (see `site-nav.tsx`) |
| Animate a number | `useMotionValue` + `animate()` (see `score-ring.tsx`) |

### Keep it calm

This is a health tool, not a game. Keep durations short (0.2–0.5 s), use `easeOut`, and don't
animate text people are reading. On `/watch` the score updates about 10 times per second:
**don't add long animations to it**, or it will lag behind.

---

## 14. Styling, conventions and page states

### Styling

- **Use theme colours, not raw colours.** Write `bg-primary`, `text-muted-foreground`, `border`,
  `bg-destructive`, not `bg-blue-500` or `#333`. We can rebrand by editing `app/globals.css`, and
  dark-mode colours are already defined there (a light/dark switch isn't wired up yet, but theme
  colours will just work when it is).
- **Tailwind v4:** there's no `tailwind.config.js`. Theme tokens live in `app/globals.css`.
- **Merge classes with `cn()`** when a component accepts `className`.
- **Mobile first.** People will check `/watch` and `/device` on phones. Test at phone width.

### Conventions

- **Files:** `kebab-case.tsx`. **Components:** `PascalCase`.
- **Imports:** always use the `@/` alias (`@/components/...`, `@/lib/...`).
- **Server first.** Pages fetch data on the server. Put clicks, state and animation in small
  `"use client"` components.
- **App components** go in `components/posture/` (or a new folder named after the feature),
  **not** in `components/ui/`.
- **No `Math.random()` or `Date.now()` during render.** They cause hydration errors.
  (Inside `useEffect`, event handlers or server-only code is fine.)
- **Next.js 16 changed some APIs.** `params` and `searchParams` are Promises (`await params`),
  and page props are typed with `PageProps<"/route">`. When a tutorial doesn't work, check
  `node_modules/next/dist/docs/`.
- Mark unfinished work with `// TODO:` so it's easy to find.

### Every page needs these states

| State | When | What to show |
| --- | --- | --- |
| **Loading** | Data is being fetched | Skeletons (`components/ui/skeleton`), never a blank page |
| **Empty** | Function returned `null` or `[]` | Friendly message + next step ("Connect your sensor on the Device page") |
| **Live** | Session running / sensor connected | A clear "Live" badge |
| **Disconnected / error** | Sensor lost, upload failed | What happened + what to do |

Test empty states in **real mode with no data**, since mock mode always has data.

---

## 15. Working with AI agents

Your AI agent (Claude Code, Cursor, Copilot, …) is a big help here, as long as it knows our rules.

### How agents find this guide

- `app/AGENTS.md` and `app/CLAUDE.md` already point to this file, so most agents read it automatically.
- If yours doesn't, **paste the starter prompt below** at the start of every new chat.

### Tips

- **Start every chat with the starter prompt.** Agents forget everything between chats.
- **Ask for a plan first** on anything bigger than one component, then say "go".
- **Name the files** you want changed. Vague requests lead to changes in the wrong places.
- **Read the diff** before accepting. If it touched a file from [section 11](#11-files-to-leave-alone), undo that part.
- **Make it run the checks.** `bun run lint` and `bun run build` must pass.

### Starter prompt (paste first, every new chat)

```text
You're helping the frontend team of "reallign", a posture-tracking web app.
Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI,
Motion ("motion/react"), lucide-react icons, sonner toasts. Package manager: Bun.
The app lives in the app/ folder.

Before writing any code, read app/DOCS.md fully. It is the source of truth for our rules,
data functions, types and components. Also read app/AGENTS.md.

Rules you must follow:
1. Pages get data ONLY from functions in lib/data.ts, called in server components.
   Pass data to client components as props. Never import lib/mock-data.ts or anything
   from lib/supabase/ in pages or components. Never import lib/data.ts in a "use client" file.
2. Do not edit: lib/data.ts (except adding new mock functions), lib/esp32/*, lib/supabase/*,
   lib/watch-token.ts, app/api/*, proxy.ts, next.config.ts, .env files, the esp32 folder.
   Do not import from app/demo/.
3. shadcn here uses Base UI, NOT Radix: use the `render` prop, never `asChild`.
4. Animation: import from "motion/react". Any file using motion needs "use client".
   In server pages, use FadeIn / Stagger / StaggerItem from @/components/motion/fade-in.
5. Use theme colour classes (bg-primary, text-muted-foreground, …), never raw colours.
   Merge classes with cn() from @/lib/utils.
6. Next.js 16: params and searchParams are Promises; type pages with PageProps<"/route">.
   If unsure about an API, check node_modules/next/dist/docs/ instead of guessing.
7. No Math.random() or Date.now() during render (hydration errors).
8. Reuse helpers: statusFromScore / scoreFromAngles (@/lib/posture),
   formatDuration / sessionSeconds (@/lib/format). Reuse ScoreRing, StatusBadge,
   ReadingsBarChart from @/components/posture.
9. Every page handles loading, empty (null or []), live and error states. Mobile first.
10. Keep changes small and focused. Match the style of nearby code.
    Ask me before adding npm packages, changing lib/types.ts, or editing files outside
    app/ and components/.
11. When done, run `bun run lint` and `bun run build` in app/ and fix any errors.
    Then tell me in plain words which files you changed and why.

Reply "Ready" when you've read app/DOCS.md, then wait for my task.
```

### Task prompts (fill in the [brackets])

**Redesign a page**

```text
Redesign [app/page.tsx — the Dashboard]. Goal: [clean, calm health-app look; the current
score is the hero; today's stats below; works well on phones].
Keep all the data calls exactly as they are. Only change layout, styling and components.
Handle the empty state (no readings yet) and loading (skeletons).
First show me a short plan (layout + which components), wait for my OK, then build it.
```

**Build a new component**

```text
Create a component [components/posture/trend-chart.tsx] that shows [the score over the
last 60 minutes as a smooth line]. Props: [readings: PostureReading[] from @/lib/types].
It must be a client component if it uses charts or motion. Use theme colours only.
Then use it in [app/page.tsx], passing the data the page already fetches with
getRecentReadings(60). Show an empty state when the array is empty.
```

**Add a shadcn component**

```text
I need a [dialog / dropdown-menu / tooltip]. Install it with
`bunx --bun shadcn@latest add [name]` in app/, then use it in [file] to [do what].
Remember we use Base UI (render prop, no asChild).
```

**Need data that doesn't exist yet**

```text
The [Settings] page needs [the user's slouch threshold]. Following section 5 of
app/DOCS.md: add a function [getSettings()] to lib/data.ts that returns MOCK data only
(same pattern as the other functions, including the mock-mode delay), add its type to
lib/types.ts, and use it in [app/settings/page.tsx]. Don't touch any real database code.
Write a short note I can send to the backend lead describing what the real function needs.
```

**Polish states**

```text
Go through [app/history/page.tsx and app/history/[id]/page.tsx] and make sure every state
from section 14 of app/DOCS.md is handled: loading skeletons, empty state, live badge,
error/not-found. Test the empty state by reasoning about what happens when the data
functions return [] or null. List what was missing before you fix it.
```

**Add animation**

```text
Add subtle animation to [the session cards in app/history/page.tsx]: [fade + slide up
on load, staggered; small lift on hover]. Use our FadeIn/Stagger wrappers if possible,
otherwise a small "use client" component with motion/react. Durations 0.2–0.5 s, easeOut.
Nothing should animate while I'm reading it.
```

**Fix a bug**

```text
Bug: [what happens] on [page/URL]. Expected: [what should happen].
Error message (if any): [paste it].
Find the cause first and explain it in 2–3 sentences before changing anything.
If the cause is in a file I'm not allowed to edit (section 11 of app/DOCS.md),
don't edit it — tell me what to report to the backend lead instead.
```

**Review before a PR**

```text
Review my changes (git diff against the frontend branch) against app/DOCS.md:
golden rule, files to leave alone, Base UI usage, motion imports, theme colours,
page states, no Math.random/Date.now in render, mobile layout.
List problems by file with a one-line fix each. Then run `bun run lint` and
`bun run build` and report the results.
```

---

## 16. Common problems

| Problem | Why | Fix |
| --- | --- | --- |
| Hydration error mentioning `data-gr-ext-installed` or similar | A browser extension (Grammarly) edits the page | Not our bug. Ignore it, or test in a window without extensions |
| Other hydration errors | `Math.random()`, `Date.now()` or `new Date()` during render | Move it into `useEffect`, or do it on the server and pass the result as a prop |
| "No data yet" / "No sensor yet" on another browser or phone | Each browser is its own anonymous user | Expected. Watch from other devices via the **QR code** on `/device` |
| Dashboard doesn't update by itself | Pages load data once per visit | Refresh, or see the auto-refresh idea in section 18 |
| "Connect sensor" is greyed out | Browser has no Bluetooth (Safari, Firefox, or not on localhost/https) | Use Chrome or Edge on `http://localhost:3000`. On another device (opened by IP, e.g. `http://172.20.10.2:3000`), run `bun run dev:https` and open `https://<ip>:3000` instead; accept the certificate warning once (Advanced → Proceed) |
| Pairing fails at "Bluetooth link" | Another tab or device holds the sensor, or it's off or out of range | Close other tabs (incl. `/demo`), press **Disconnect everyone else**, move closer, power-cycle the sensor |
| Phone can't open the QR link | The link says `localhost` | Enter the laptop's network address (shown as "Network" when you run `bun dev`) |
| Score is always 0 / "Bad" | Sensor not calibrated for how it's worn | Ask IoT to recalibrate (`CAL`, then `FWD`, `RGT`) |
| `Cannot find module` after pulling | New packages were added | Run `bun install` |
| Build error in `.next/types` after a route was deleted | Stale generated files | Run `bun run build` again (or delete `app/.next`) |

---

## 17. Before you open a PR

- [ ] `bun run lint` passes
- [ ] `bun run build` passes
- [ ] Data comes only from `lib/data.ts` (no mock or Supabase imports in pages or components)
- [ ] No edits to files in [section 11](#11-files-to-leave-alone) (or the backend lead approved them)
- [ ] Loading, empty, live and error states handled
- [ ] Looks right on a phone-width screen
- [ ] Theme colours only; no raw hex or `bg-blue-500`
- [ ] No leftover `console.log`
- [ ] PR description says **what** changed and **why**, with a screenshot for UI changes

---

## 18. What's next

### Frontend tasks (pick one!)

| Page / area | Ideas |
| --- | --- |
| Dashboard `/` | Real chart (shadcn `chart`), calmer layout, "today vs. yesterday", auto-refresh |
| History `/history` | Weekly trend chart, date filter, nicer session cards |
| Session `/history/[id]` | Score-over-time chart instead of only a table, highlight slouch moments |
| Device `/device` | Friendly pairing flow, clearer states, nicer QR card |
| Watch `/watch` | Big, glanceable live score for a phone or TV, posture figure that tilts |
| Onboarding (new) | How to wear the sensor, first calibration ("sit straight", "lean forward") |
| Dark mode (new) | Light/dark switch with `next-themes` (installed; colours already in `globals.css`) |
| Settings (new) | Slouch threshold, alert delay, buzzer on/off (off by default), test beep, reading interval |

**Auto-refresh idea for the Dashboard:** a tiny client component that calls `router.refresh()`
every 10 seconds re-runs the page's data functions without a full reload:

```tsx
"use client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
```

### Needs backend first (ask before designing deeply)

- **Settings and calibration from the app.** The sensor already understands commands for
  threshold (`T=`), alert delay (`D=`), buzzer on/off (`ON`/`OFF`, off by default), test beep (`BUZZ`)
  and calibration (`CAL`, `FWD`, `RGT`), but `useSensorSync` doesn't expose them yet.
  Design the screens with mock behaviour; backend will add the functions.
- **Login.** Right now everyone is anonymous per browser. Real accounts are planned.
- **Battery and firmware version.** The sensor doesn't report them yet.
- **Side lean (`roll`) history.** It's live on `/device` and `/watch`, but not saved yet.

---

## 19. Glossary

| Word | Meaning |
| --- | --- |
| **Pitch** | Leaning forward/backward, in degrees. 0 = upright |
| **Roll** | Leaning left/right, in degrees |
| **Punggung / Leher** | Back / neck (the firmware's Indonesian names for the two sensors) |
| **Score** | 0–100 posture score, higher is better |
| **Status** | good (≥ 75), warning (50–74), bad (< 50) |
| **Slouch** | Leaning past the threshold. After a few seconds the slouch alert turns on (the buzzer beeps only if turned on) |
| **Sensor LEDs** | Red blinking slowly = waiting for Bluetooth, green = connected, both on = calibrating, red blinking fast = sensor chip missing |
| **Reading** | One saved data point (every 5 s by default) |
| **Sample** | One live data point from the sensor (about 20 per second, not saved) |
| **Session** | One continuous recording, from connect to disconnect |
| **Main device** | The laptop or phone with `/device` open and connected. It saves everything |
| **BLE** | Bluetooth Low Energy, how the sensor talks to the browser |
| **Pairing** | Connecting the browser to the sensor (the checklist on `/device`) |
| **Watch link** | The QR link to `/watch`. Anyone with it can watch live, no login |
| **Mock mode** | Running without `.env.local`: dummy data everywhere |
| **Server component** | Runs on the server, can `await` data, no clicks or state. The default in `app/` |
| **Client component** | Starts with `"use client"`, can use state, clicks, animation. Can't call `lib/data.ts` |
