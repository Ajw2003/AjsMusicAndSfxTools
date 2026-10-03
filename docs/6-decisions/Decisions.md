# Decisions (tier 6)

Append-only. Newest at the top. An old entry is never rewritten; when one is replaced, its
**Status** changes to `Superseded` with a pointer to the new one.

---

## 2026-10-03 — GitHub organisation: Milestones + parent issues + sub-issues

**Context.** First planning session.

**Decision.** One GitHub Milestone per roadmap milestone (M0–M8), one parent issue per milestone,
one sub-issue per buildable step. Every issue I create is labelled `Claude created this` plus a
category. Pull requests say `Refs #N`, never `Closes #N`. The owner closes issues after testing.

**Why.** Chosen by the owner over flat issues + labels. Small sub-issues are easier to pick up one
at a time.

**Status.** Standing.

## 2026-10-03 — MIT licence

**Context.** Personal project, may be shared.

**Decision.** Code is MIT. Third-party samples keep their own licences, listed in `CREDITS.md`.

**Why.** Chosen by the owner. Rejected: GPL-3.0, no licence.

**Status.** Standing.

## 2026-10-03 — Accessibility and ADHD-friendly features are first-class

**Context.** The point of the app is to be approachable for anyone.

**Decision.** Ship: theme picker (several themes), Simple/Advanced mode, note names and colours
on keys, screen reader support and full keyboard navigation, reduced motion, autosave and undo.
Keyboard access and labels are required from M1 on; M4 adds the settings and the audit.

**Why.** All four options offered were chosen by the owner. "Theme picker" was chosen over a
single fixed style.

**Status.** Standing.

## 2026-10-03 — Two keyboard layout presets, both rebindable

**Decision.** Ship "two-row piano" (A-row white keys, Q-row black keys, Z/X octave) and
"full keyboard, three rows". Use physical key positions (`KeyboardEvent.code`).

**Why.** The owner chose both. Physical positions keep the layout working on non-QWERTY keyboards.

**Status.** Standing.

## 2026-10-03 — Song making: live record + loop, piano roll, step sequencer

**Decision.** All three, sharing one song model. Recording/looping comes first (M5), the two
editors later (M7).

**Why.** The owner chose all three. Record-and-loop gives a usable song soonest; export (M6)
comes before the editors so songs can leave the app early.

**Status.** Standing.

## 2026-10-03 — Export: WAV, MP3/OGG, MIDI and project file

**Decision.** All four. WAV and project file are straightforward. The MP3/OGG encoder and MIDI
library get picked in their issues, open source first.

**Status.** Standing.

## 2026-10-03 — Hybrid instrument sounds

**Decision.** Real recordings (free-licensed sample packs) for piano, acoustic guitar, electric
guitar, bass, drums. Generated in code for chiptune, stylophone, theremin. Users can import
their own samples.

**Why.** The owner chose it over all-synth (cheap but fake-sounding piano/guitar) and all-sampled
(heavy, and electronic instruments don't need it). Sample sources have not been verified yet;
that's the first M2 issue.

**Status.** Standing.

## 2026-10-03 — Web app: TypeScript + Vite + Svelte + Tone.js

**Context.** Platform choice for a personal, shareable, accessible music toy.

**Decision.** A browser app, installable offline (PWA) later. TypeScript (strict), Vite build,
Svelte for UI, Tone.js on the Web Audio API, Vitest for tests, ESLint + Prettier, npm.

**Why.** Chosen by the owner. Runs on any OS and phones with no install, and browsers have good
built-in accessibility support. All open source (MIT). Rejected: Tauri/Electron desktop (can wrap
the web app later if needed), Python desktop (harder to make look good and to share). Svelte over
React (more boilerplate) and plain TypeScript (gets messy by the piano roll).

**Status.** Standing.
