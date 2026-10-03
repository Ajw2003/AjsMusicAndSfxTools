# Project state (tier 3): where it stands right now

**As of 2026-10-03. Overall: about 20% of 100%. M0 built; a chiptune song prototype (#68) covers
most of M1 and parts of M2, M5, M6 and M7 but no milestone is fully done.**

M0 is built: docs, issues, an empty app that builds, code checks and CI, which passed on GitHub on
commit 853fe43. The one acceptance step not yet checked is `npm run dev` on the owner's own PC.
The chiptune prototype lets you play, record loops on up to 8 tracks, undo, autosave, save/open
projects and download a WAV. Checked by a headless-browser run (21/21 checks, details below).

| Milestone | Share | Status | Parent issue |
|---|---|---|---|
| M0: Foundation | 5% | Built; CI green; owner's local run not yet checked | #1 |
| M1: Playable keyboard | 10% | Mostly built (latency #15 not measured; owner test pending) | #6 |
| M2: Instruments | 15% | Chiptune only (#25); no samples | #16 |
| M3: Customising sounds and keys | 10% | Not started | #28 |
| M4: Themes and accessibility | 10% | Not started | #34 |
| M5: Record and loop | 10% | Mostly built (loop mode, undo, autosave, metronome, quantize) | #42 |
| M6: Save and export | 10% | Project files + WAV built; MP3/OGG, MIDI, options not | #51 |
| M7: Piano roll and step sequencer | 10% | Read-only loop view only | #57 |
| M8: Installable, offline and polished | 5% | Not started | #62 |
| M9: Arranger | 15% | #71, #72, #73, #76 built on branch (not merged); #74, #75 and phases B–D not started | #70 |

## M0: Foundation

- **Done:** six doc tiers, `CLAUDE.md`, `LICENSE` (MIT), `CREDITS.md` (empty, no samples yet),
  9 GitHub Milestones, 9 parent issues, 57 sub-issues (#2).
- **Done:** app shell, Vite 8 + Svelte 5 + TypeScript 6 strict (#3); Prettier, ESLint, svelte-check,
  Vitest with one real test of `src/lib/note-names.ts` (#4); GitHub Actions CI in
  `.github/workflows/ci.yml` (#5). All five checks pass locally and in CI (run 37134666466).
- **Live:** https://ajw2003.github.io/AjsMusicAndSfxTools/ serves the app (HTTP 200, page and script
  checked 2026-10-03) after the owner switched Pages on and the deploy run 37136626267 was re-run
  successfully. Every push to `main` redeploys.
- **Not checked:** `npm run dev` on the owner's Windows PC (Node.js may not be installed there).

## Chiptune prototype (#68)

Plan: `docs/plans/chiptune-prototype.md`. Built in three chunks (pure logic, engine + keyboard, recording + tracks + export).

- **Checked (headless Chromium, 2026-10-03, run twice by the builder and once by the parent):** record with
  count-in → 3 notes stored after the loop wraps; second track records; undo/redo by button and Ctrl+Z /
  Ctrl+Shift+Z; reload restores both tracks from autosave; WAV download 529,244 bytes with 121,734 non-zero
  samples; drum keys labelled Kick/Snare/Hat; no horizontal scroll at 1280/390/360 px; one octave on phone;
  no console or page errors. 66 unit tests pass.
- **Also checked after merge (same build as live, `index-VPZK03c6.js`):** Open project with a valid file
  restores 2 tracks and BPM 100; an invalid file shows an error and keeps the current song; New song clears it.
- **Not checked:** anything heard by a person (headless has no speakers); real phone touch (only emulated);
  key-to-sound latency (#15, needs the owner's PC).
- **Known rough edges:** Stop during the count-in can still play the remaining clicks (they are pre-scheduled);
  phone white keys are 41–45 px at 360 px wide; drum tracks show 2 octaves on phone so all three drums fit.

## M9: Arranger (#70)

Plan: `docs/plans/arranger-timeline.md`. Handoff detail: `docs/5-today/Today.md`.

- **Built, on branch only:** song format v2 (#71), checked: 95 unit tests, browser regression 23/23.
- **Built, on branch only (2026-10-03):** timeline view, playback from the playhead with a loop toggle, and
  recording into clips (#72, #73, #76). Checked: types, lint, format, 102 unit tests, production build, and
  `e2e/timeline.cjs` in headless Chromium, 22/22, run twice. It records a pass into a clip, measures that a
  stretched clip sounds 4 times 1.000 s apart, checks the loop region repeats bar 2 only, gets a 17.00 s WAV for a
  16 s song, and checks a 64-bar song at 390 px and 1280 px wide with no page-level sideways scroll. Screenshots
  were looked at in light and dark mode.
- **Not checked:** heard by a person; real phone touch; that the old prototype flows still feel the same.
- **Not started:** #74, #75, #77–#82.

## The one thing that is not what it looks like

The prototype looks like most of M1 and M5 are done, but no milestone's acceptance has been checked by a
person yet: nobody has listened to it, and the M1 latency number doesn't exist. Treat the table above as
"built", not "done".

## Cross-cutting issues that belong to no milestone

- **Sample licences.** Nothing about sample sources has been verified. Until #17 is done, any
  sample pack named in the docs is a candidate, not a choice.
- **Node.js on the owner's PC.** Not recorded whether it's installed. Building from source needs it.
- **Key-to-sound latency** has not been measured anywhere (#15).
