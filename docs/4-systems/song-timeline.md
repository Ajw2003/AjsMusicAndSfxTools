# Song timeline

**Built?** Song format v2 with clips, 2026-10-03 (#71): `src/lib/song/song.ts` holds tracks → clips; a clip
repeats its source loop (`loopBeats`) to fill `lengthBeats`, trimmed by `offsetBeats`; `expandClipNotes`
turns a clip into absolute timeline notes for the engine. Old (v1) songs and autosaves upgrade on load in
`src/lib/song/storage.ts` (each track's notes become one clip at bar 1; loop region = the old loop).
A `batch` command groups multi-step edits into one undo.

**Timeline view and recording into clips, 2026-10-03 (#72, #73, #76):** `src/components/Timeline.svelte` shows
track lanes (`TrackHeader.svelte`, `ClipBlock.svelte`) under a bar ruler; geometry, zoom and ruler ticks are
pure helpers in `src/lib/song/timeline-view.ts`. Record picks its target with `recordTarget`
(`timeline-view.ts:108`): the selected clip, else the selected track's clip under the playhead, else a new clip
at that bar (made only once a note is played, so an empty take leaves nothing behind). While recording the
transport loops the target's first pass (`regionFor`/`aimRecording`, `src/App.svelte:214`); notes are
recorded relative to that span and moved into the clip's source loop by `toClipSource` (`timeline-view.ts:138`),
which accounts for trim. One pass is still one undo step. Not built yet: dragging clips (#74), the clip inspector,
split, duplicate, copy/paste (#75).

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
