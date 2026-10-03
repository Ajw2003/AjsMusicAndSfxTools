# Song timeline

**Built?** No. Planned design, 2026-10-03. Rewrite this against the code once it exists.

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
