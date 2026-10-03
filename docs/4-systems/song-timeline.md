# Song timeline

**Built?** Song format v2 with clips, 2026-10-03 (#71): `src/lib/song/song.ts` holds tracks → clips; a clip
repeats its source loop (`loopBeats`) to fill `lengthBeats`, trimmed by `offsetBeats`; `expandClipNotes`
turns a clip into absolute timeline notes for the engine. Old (v1) songs and autosaves upgrade on load in
`src/lib/song/storage.ts` (each track's notes become one clip at bar 1; loop region = the old loop).
The UI still shows only the loop region; the timeline view is #73. Recording goes into each track's first
clip (`recorder.ts`), one pass = one undo step. A `batch` command groups multi-step edits into one undo.

## What it owns

The data model for a song: tempo, time signature, tracks (one instrument each), and the note
events on each track. Live recording, loop layering, the piano roll and the step sequencer
are all different views and editors of this one model. Undo/redo lives here.

## How it works

- A note event: `{ id, pitch (MIDI number), startBeat, durationBeats, velocity }`, plus
  pointer-movement data for theremin tracks. Times are stored in **beats**, not seconds, so
  changing tempo doesn't break a song.
- Recording captures live note events with timestamps, converts them to beats against the
  transport, and optionally snaps them to a grid (quantize).
- Loop mode: a track has a loop length in bars; recording over a loop adds a new layer track.
- Piano roll: notes as coloured blocks (colour = track's instrument); drag to move/resize.
- Step sequencer: a grid view of the same events at fixed step length, mostly for drums and chiptune.
- Every edit goes through one command function so it can be undone.

## Invariants

- There is one song model. The piano roll and step sequencer never keep their own copies.
- Every edit is undoable.
- The model is plain data (serialisable to JSON) so persistence can save it directly.

## Traps

- A note recorded across the loop boundary needs a rule (split or wrap). Decide this in the
  recording issue and record it in Decisions.
