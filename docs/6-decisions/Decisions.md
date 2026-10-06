# Decisions (tier 6)

Append-only. Newest at the top. An old entry is never rewritten; when one is replaced, its
**Status** changes to `Superseded` with a pointer to the new one.

---

## 2026-10-06 — Sample packs for piano, guitars, bass and drums

**Context.** #17: pick free sample packs whose licences are read at the source. The owner answered the three
questions in `docs/plans/sample-sources.md`: credit-required (CC BY) is fine, share-alike (CC BY-SA) is fine
for drums as a fallback, and each instrument stays under 2 MB.

**Decision.** Piano: Salamander Grand Piano V3 (CC BY 3.0). Acoustic guitar, electric guitar, bass:
tonejs-instruments (CC BY 3.0; from Iowa and Karoryfer recordings). Drums: Salamander Drumkit (CC BY-SA 3.0).
Credits are in `CREDITS.md`; sources and quotes in `docs/plans/sample-sources.md`.

**Why.** Each licence was read at its source. The public-domain Open Source Drumkit was the first drum pick, but
its download carries no licence and only news posts call it public domain, so the CC BY-SA fallback was used.

**Status.** Standing.

---

## 2026-10-06 — Polyphonic chiptune tracks use our own voice pool, not Tone's PolySynth

**Context.** The owner reported (#95) that spamming keys stutters and glitches. Measured: Tone's `PolySynth`
drops any note past its voice limit ("Max polyphony exceeded. Note dropped.") and only takes back finished
voices on a once-a-second timer (`_collectGarbage` in `node_modules/tone/build/esm/instrument/PolySynth.js`).
A fast run of notes therefore needs a fresh voice per note; 300 presses in one burst dropped 204. Raising the
limit to 96 only made it rarer (7 dropped in one of four busy test runs).

**Decision.** Polyphonic tracks share a pool of 32 `Tone.Synth` voices (`buildVoicePool` in
`src/lib/audio/engine.ts`). A voice is free again as soon as its release ends; when all are busy the oldest
note (fading notes before held ones) is taken over, so a played note is never dropped. At most 10 notes are held
by hand at once.

**Why.** Deterministic, with no timer to fall behind. Rejected: a still higher PolySynth limit (same race, more
voices built in a burst), limiting how fast notes can be played (drops notes the player meant).

**Status.** Standing.

---

## 2026-10-05 — Recording runs on in a straight line, not as a loop pedal

**Context.** Since #76, Record looped the transport over the target clip's first pass (16 beats for a new
clip), storing one pass per loop, like a loop pedal. The owner found that bad: "it'll only record to count of
16 and then it automatically loop over the existing recording … it should continue on indefinitely … until you
stop pressing record" (#96).

**Decision.** While recording, playback ignores the Loop region and the song end (`setFreeRun`,
`src/lib/audio/engine.ts:372`). At each bar line the finished notes are stored and the clip grows in whole bars
to cover them, stopping at the next clip on its track, where recording carries on into that clip
(`recordedNotesEdit`, `src/lib/song/timeline-view.ts:154`; `src/App.svelte:532`). The bars of one take are
folded into a single undo step (`SongHistory.amend`, `src/lib/song/song.ts:511`).

**Why.** The owner's request. It is also how most recorders behave by default. Layering over a loop is still
possible by recording into a clip again; a repeating clip keeps repeating its pattern.

**Status.** Standing. Replaces the loop-recording part of the arranger design (#76).

 the look-ahead; playback keeps Tone's default

**Context.** The engine set Tone's scheduling look-ahead to 20 ms so notes played by hand felt immediate.
While building the chord builder (#77), a browser check caught a chord clip's last chord starting 31 ms late:
song notes are scheduled only one look-ahead before they sound, so any main-thread pause longer than that
makes them late.

**Decision.** Song playback uses Tone's default 100 ms look-ahead. Live note-on, note-off and release-all use
the audio clock's present moment (`Tone.immediate()`), so playing by hand has no added delay. The playhead
and recording timestamps read the position being heard at that moment rather than the scheduling position.

**Why.** Measured in headless Chromium: a live key press now starts its note 0.0 ms after the call (it was 20
ms or more). The chord-clip check passed on every run after the change. Rejected: a middle value such as
50 ms, which would still add 50 ms to every live note and still fail under a longer pause. Supersedes the
20 ms choice in `src/lib/audio/engine.ts` (not previously logged here).

**Status.** Standing.

## 2026-10-03 — Add Playwright for browser checks

**Context.** The arranger's timeline, dragging and playback can only be properly checked in a real browser.
Those checks were scripts in a reclaimed session folder, then a hand-run `e2e/timeline.cjs` using a
Playwright install outside the project. The owner approved adding it.

**Decision.** `playwright` 1.63.0 (open source, Apache-2.0) is a pinned dev dependency. `npm run test:e2e`
builds the app, serves the build with Vite's preview server and runs `e2e/timeline.cjs` in Chromium; CI
installs Chromium and runs it on every push.

**Why.** It drives real pointer, touch and keyboard input and reads the page as a person would. Rejected:
`@playwright/test` (a whole test runner, not needed for one script yet) and hand-checking (not repeatable).

**Status.** Standing.

## 2026-10-03 — Add an arranger timeline (M9) and rebalance the roadmap

**Context.** After trying the chiptune prototype the owner asked for video-editor-style timeline
controls to drag and layer audio and chord progressions. Their answers: loops become clips with easily
editable length and attributes; note clips, imported audio and microphone recording; a chord builder whose
chords are saved as one-key pads; unlimited song length. Plan: `docs/plans/arranger-timeline.md`.

**Decision.** New milestone M9: Arranger (15%). Song format v2 stores clips on tracks; v1 songs upgrade
automatically. To keep the total at 100%, M1, M5 and M7 each drop from 15% to 10%, because the loop
recorder (M5) and the read-only lane (M7) are now partly absorbed into the arranger. Audio is stored in
IndexedDB and embedded in project files as base64, so no new dependency and one file per song.

**Why.** Rejected: replacing the loop recorder (the owner wants loops kept as the way to make clips),
and a separate arrange mode (more screens, against calm-by-default). Base64 in JSON was chosen over a zip
format to avoid a dependency; it makes files about a third larger, which is fine at this scale.

**Status.** Standing.

## 2026-10-03 — First prototype is a chiptune loop-pedal song builder

**Context.** The owner asked for "a usable prototype worth showing where I can actually make a song with
even one type of sound, i.e. only chiptune first." Plan: `docs/plans/chiptune-prototype.md`.

**Decision.** Build a loop-based song (1–8 bars, repeating) with up to 8 tracks, each one chiptune sound;
record over the loop, each pass is one undo step; autosave to localStorage; project file and WAV export.
The transport counts in ticks so tempo changes never move notes. Mute works by not scheduling the track,
so live play on a muted track still sounds.

**Why.** Smallest thing that makes a real song, and it is the M5 loop mode from the song-timeline design, so
nothing is throwaway. Rejected for now: a free timeline (needs the piano roll first) and building every
instrument before any song features.

**Status.** Standing.

## 2026-10-03 — Public test site on GitHub Pages, deployed from main

**Context.** The owner wanted to test the app on their phone. A private claude.ai page works but
has to be republished by hand.

**Decision.** A GitHub Actions workflow (`.github/workflows/pages.yml`) builds and deploys to
https://ajw2003.github.io/AjsMusicAndSfxTools/ on every push to `main`, plus a manual "Run workflow"
button. Built with `--base ./` because Pages serves from a sub-path.

**Why.** Updates itself, opens on any device. Accepted trade-off: anyone with the address can open
it (the repo is already public). Deploying only from `main` keeps half-finished branch work off the
site. Pages had to be switched on by the owner in repo settings; the agent's GitHub access can't
change that setting.

**Status.** Standing.

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
