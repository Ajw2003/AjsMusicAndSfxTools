# Roadmap (tier 2): what "done" means

The finished app: a web keyboard you can play with your computer keyboard, mouse or touch, with
eight built-in instruments plus your own sounds, rebindable keys, themes and accessibility
settings. You can record, loop, edit in a piano roll or step sequencer, and export WAV, MP3/OGG,
MIDI and project files. Clips are arranged on a timeline like a video editor, with a chord builder
and imported or microphone audio. It installs and works offline.

Percentages are each milestone's share of the whole (they add to 100). A milestone counts as done
only when its **Acceptance** has actually been checked by running the app, not when the code exists.

Accessibility is not saved for one milestone. From M1 on, everything built must work by keyboard
alone and have proper labels (see the conventions in [the landing page](../1-landing/README.md#conventions)).
M4 adds the settings and the full audit.

Each milestone is a GitHub Milestone with a parent issue and sub-issues.

---

## M0: Foundation (5%)

Repo, docs, tooling and an empty app that builds.

**Contains:** six-tier docs, CLAUDE.md, licence, credits file; Vite + Svelte + TypeScript app shell;
Prettier, ESLint, Vitest; GitHub Actions CI running lint, type check, tests and build.

**Acceptance:** `npm ci && npm run check && npm test && npm run build` passes on a fresh clone and
in CI; `npm run dev` shows the blank app page in a browser.

## M1: Playable keyboard (10%)

*Share changed 2026-10-03 from 15% to 10% to make room for M9 (see Decisions).*

A keyboard on screen that you can play and hear, using one simple generated sound.

**Contains:** audio engine start-up (click to start); on-screen keyboard (at least 2 octaves) with
pressed-key glow; play by mouse, touch and computer keyboard; both layout presets (two-row piano,
three-row full keyboard); octave shift; note-name labels and bound-key labels on each key;
held notes released on focus loss; volume control.

**Acceptance:** on the owner's Windows PC in a browser: play a C major scale with the mouse and
again with the keyboard in each preset; a chord of 4 held keys sounds; no stuck notes after
alt-tabbing mid-chord; key-to-sound delay feels instant (target under 30 ms, measured once and
recorded in ProjectState).

## M2: Instruments (15%)

The eight default instruments.

**Contains:** sample sourcing with verified free licences and `CREDITS.md`; instrument
definitions and picker; sampled piano, acoustic guitar, electric guitar, bass, drums (drum kit
per key); generated chiptune, stylophone (drag-to-play), theremin (pointer pitch/volume pad);
on-demand sample loading with loading state and failure fallback.

**Acceptance:** each of the eight instruments is selectable and plays; theremin plays by moving
the pointer; stylophone plays by dragging; turning off the network after first load of an
instrument doesn't break it for that session; every shipped sample is listed in `CREDITS.md`.

## M3: Customising sounds and keys (10%)

Make it yours.

**Contains:** key rebinding screen with conflict warning and reset; per-instrument sound
controls (volume, attack/release, tone, reverb, delay); save/load your own sound presets;
import your own samples (drop audio files onto keys); all settings persist across reloads.

**Acceptance:** rebind a note key, reload, the binding is still there; make a custom preset
from piano with reverb, reload, it's still there; import a WAV as a new instrument and play it.

## M4: Themes and accessibility (10%)

Comfortable for anyone, including ADHD-friendly calm.

**Contains:** theme picker (calm dark, light, high-contrast, bright & playful at minimum);
Simple/Advanced mode (Simple hides everything but the keyboard and instrument picker);
note labels choice (C D E / Do Re Mi / none); colour-per-note option; reduced-motion setting
(and respecting the OS setting); screen reader labels and live announcements; full keyboard
navigation of every control; accessibility audit.

**Acceptance:** every control reachable and usable with keyboard only; an automated
accessibility check (axe) shows no serious issues on each screen; NVDA (free Windows screen
reader) reads the instrument picker and settings correctly; each theme passes WCAG AA contrast.

## M5: Record and loop (10%)

*Share changed 2026-10-03 from 15% to 10% to make room for M9 (see Decisions).*

Turn playing into music.

**Contains:** song timeline model with undo/redo; tempo and metronome with count-in;
record live playing to a track; playback; loop mode with layering new tracks over the loop;
quantize; track list (mute, solo, volume, instrument, delete); autosave to the browser.

**Acceptance:** record a 4-bar drum loop, layer bass and piano on top in loop mode, undo the
last layer, close and reopen the tab, the song is still there and plays back correctly.

## M6: Save and export (10%)

Get your work out.

**Contains:** project file save/open (`.ajsong.json`, versioned); WAV export; MP3 and/or OGG
export; MIDI export; export options (whole song / selected tracks / loop count).

**Acceptance:** export the M5 song as WAV, MP3/OGG and MIDI; the audio files play in Windows'
media player and sound the same as in the app; the MIDI opens in a free program (e.g. MuseScore)
with the right notes; a saved project opens again with nothing missing.

## M7: Piano roll and step sequencer (10%)

*Share changed 2026-10-03 from 15% to 10% to make room for M9 (see Decisions).*

See and fix the notes.

**Contains:** piano roll view (notes as coloured blocks, zoom, scroll, add/move/resize/delete,
velocity); step sequencer view (grid, per-row instrument/drum, pattern length); both edit the
same song model; keyboard-accessible editing.

**Acceptance:** fix a mistimed recorded note in the piano roll, program a drum beat in the step
sequencer, see both changes in the other view, and hear them on playback; undo works for both.

## M8: Installable, offline and polished (5%)

**Contains:** PWA (install as an app, works offline, samples cached); first-run welcome that
shows how to play in under 30 seconds; performance pass; Settings → About/credits.

**Acceptance:** install from Edge or Chrome on the owner's PC, turn off Wi-Fi, open it, play every
instrument already downloaded, record and export a WAV.

## M9: Arranger (15%)

*Added 2026-10-03 at the owner's request; plan in `docs/plans/arranger-timeline.md`.*

A timeline like a video editor's: recorded loops, chord progressions and audio become clips you drag,
stretch, trim and layer.

**Contains:** song format v2 (clips) with automatic upgrade of old songs; timeline that grows without a
limit, with zoom and scroll; move, stretch (repeat), trim, split, duplicate, copy and paste clips with snap;
clip inspector with typed fields for every drag; play from the playhead with an optional loop region;
record into a clip in loop mode; chord builder (key, suggested chords, durations) making note clips;
saved one-key chord pads you play live and record; audio tracks with imported WAV/MP3/OGG clips and
waveforms; microphone recording into audio clips; audio carried in project files and WAV export.

**Acceptance:** on the live site, make a 16-bar song with: a drum loop clip repeated by stretching, a
chord-builder progression clip, a bass clip moved to start at bar 5, an imported audio file trimmed to
fit, and a short microphone recording; then do every clip edit again using only the keyboard and
inspector; reload and everything is still there; save, open in a fresh tab, and the audio is still
there; export WAV and it sounds the same as playback.
