# Project state (tier 3): where it stands right now

**As of 2026-10-04. Overall: about 20% of 100%. M0 built; a chiptune song prototype (#68) covers
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
| M4: Themes and accessibility | 10% | Usability pass #84 built (reading settings, axe scan); themes, modes not started | #34 |
| M5: Record and loop | 10% | Mostly built (loop mode, undo, autosave, metronome, quantize) | #42 |
| M6: Save and export | 10% | Project files + WAV built; MP3/OGG, MIDI, options not | #51 |
| M7: Piano roll and step sequencer | 10% | Read-only loop view only | #57 |
| M8: Installable, offline and polished | 5% | Not started | #62 |
| M9: Arranger | 15% | Phases A (#71–#76, PR #83) and B (#77, #78, PR #85) live; C, D not started | #70 |

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

- **Merged and live 2026-10-03 (PR #83, merged by the owner, CI green incl. browser checks, Pages deploy
  run 37152072987 succeeded):** everything below.
- **Built:** song format v2 (#71), checked: 95 unit tests, browser regression 23/23.
- **Built (2026-10-03):** timeline view, playback from the playhead with a loop toggle, and
  recording into clips (#72, #73, #76). Checked: types, lint, format, 102 unit tests, production build, and
  `e2e/timeline.cjs` in headless Chromium, 22/22, run twice. It records a pass into a clip, measures that a
  stretched clip sounds 4 times 1.000 s apart, checks the loop region repeats bar 2 only, gets a 17.00 s WAV for a
  16 s song, and checks a 64-bar song at 390 px and 1280 px wide with no page-level sideways scroll. Screenshots
  were looked at in light and dark mode.
- **Built (2026-10-03):** drag clips to move/stretch/trim with snap (#74), clip inspector with
  split/duplicate/copy/paste/delete and shortcuts (#75). `e2e/timeline.cjs` now has 49 checks, including every
  drag type snapping and undoing in one step, and a keyboard-only run through every clip edit. Passed 3 times in a
  row after a fix for a one-frame playhead flicker at the loop wrap, which run 2 of an earlier batch caught.
  110 unit tests.
- **Touch (emulated, 2026-10-03):** real touch events on a 390 px phone page move, stretch and re-track a clip, and
  a swipe on an empty lane still scrolls the timeline. 53/53 browser checks, run twice.
- **Not checked:** heard by a person (the test browser has no speakers); a physical phone (only emulated touch,
  as there is no device here); picking a colour with the keyboard alone (the browser's own colour picker
  can't be driven from the test). Clips cover the lane they sit in, so on a phone a long song is scrolled by
  swiping the ruler or empty lane space, not by swiping a clip.
- **Merged and live 2026-10-04 (PR #85, merged by the owner; CI green; Pages deploy run 37166837843
  succeeded):** chord builder that makes chord clips (#77) and one-key chord pads (#78).
  Checked: 126 unit tests; `npm run test:e2e` 62/62, twice. It builds I–V–vi–IV in D (D A Bm G), checks the clip's
  notes and chord names, and times playback (4 chords of 3 notes, 1.000 s apart, nothing after the end). It also
  records pads by keys 1–4, gets the four chords back, and finds the pads after a reload. Screenshots checked.
- **Fixed on the way (2026-10-04):** reaching the song end could replay beat 0's notes (4 of 12 runs; 0 of 12
  after); song playback could start late under load (now 100 ms look-ahead), while live key presses now start
  0.0 ms after the press instead of 20 ms or more. See Decisions, 2026-10-04.
- **Not started:** #79–#82.
- **Next UI pass, in progress:** #84 (dyslexia and ADHD usability), steps #86–#90, owner-approved
  2026-10-04 and scheduled before phase C. Scrubbing and step 1 (#86) merged in PR #91.
- **Usability steps 2–5 built 2026-10-04, on branch `claude/modest-mendel-kfiuw7`, not merged:** plain words on
  every label (#87); a Reading panel with four bundled fonts, three text sizes and Relaxed spacing, saved in the
  browser, no text under 14 px (#88); a red recording bar, a large 4-3-2-1 count-in, a "Deleted … Undo" message
  and first-time hints (#89); an axe accessibility scan of 14 screens at desktop and phone width in the browser
  checks (#90). Checked: format, lint, types, 128 unit tests, `npm run test:e2e` 189/189 ("ALL PASS"), run at
  least twice per step; axe reports 0 issues of any level on every scanned screen. Screenshots and the axe table:
  `docs/generated/usability/README.md`.
- **Not checked:** a try-out by someone with dyslexia or ADHD (the owner); a real screen reader; heard by a
  person. Known rough edges: the count-in number briefly covers the timeline; black-key labels stack
  ("G" over "#") with OpenDyslexic + Larger + Relaxed on a phone; track and master volume show a bare number.

## The one thing that is not what it looks like

The prototype looks like most of M1 and M5 are done, but no milestone's acceptance has been checked by a
person yet: nobody has listened to it, and the M1 latency number doesn't exist. Treat the table above as
"built", not "done".

## Cross-cutting issues that belong to no milestone

- **Sample licences.** Nothing about sample sources has been verified. Until #17 is done, any
  sample pack named in the docs is a candidate, not a choice.
- **Node.js on the owner's PC.** Not recorded whether it's installed. Building from source needs it.
- **Key-to-sound latency** has not been measured anywhere (#15).
