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
at that bar (made only once a note is played, so an empty take leaves nothing behind).

**Recording runs on in a straight line, 2026-10-05 (#96; replaces the loop recording of #76):** while recording,
the engine's free run (`setFreeRun`, `src/lib/audio/engine.ts:372`) ignores the Loop region and the song end.
Notes are kept in timeline beats; at every bar line `commitNotes` (`src/App.svelte:532`) stores the finished ones
through `recordedNotesEdit` (`timeline-view.ts:154`), which grows the clip in whole bars (never shrinking it,
never past the next clip on the track) and moves the notes into its source loop with `toClipSource`. A repeating
clip keeps its pattern length. When the playhead reaches the next clip, recording carries on into it. All bars
of one take are one undo step (`SongHistory.amend`, `src/lib/song/song.ts:511`). Stopping past the song end also
stops playback there.

**Editing clips, 2026-10-03 (#74, #75):** dragging is worked out by `dragClip` (`timeline-view.ts:237`): move, stretch
(right edge; the loop is kept so content repeats) or trim (left edge; the trim offset shifts so the notes that
stay keep their place). The edge being moved snaps to the absolute grid (Snap: Off/Beat/Bar), not by the drag
distance. The timeline previews the drag and commits it once on release through `onClipEdit` (`src/App.svelte:217`),
a `moveClip` + `updateClip` batch, so one drag is one undo step. The dragged clip stays mounted in its own lane
during a cross-track drag (it holds the pointer capture), and a dashed ghost shows the target. Arrow keys on a
focused clip do the same edits. `ClipInspector.svelte` has typed fields for every clip setting. Split, duplicate,
copy, paste and delete use the existing commands. Copy/paste uses an in-app clipboard, not the system one, and
pastes on the selected track at the playhead. Shortcuts are Ctrl+E/D/C/V and Delete, matched by physical key.

**Scrubbing, 2026-10-04 (owner's request):** pressing and dragging on the ruler, or on empty lane space with a mouse
or pen, moves the playhead continuously (`startScrub`/`moveScrub` in `Timeline.svelte`, pointer-captured); presses
that start on a clip are left to the clip's own drag. On touch, the ruler scrubs but a lane swipe still scrolls the
timeline (a tap seeks). The whole timeline grid has `user-select: none`, so drags never select text.

**Chords, 2026-10-04 (#77, #78):** `src/lib/song/chords.ts` holds the theory: the seven chords of a major or minor
key with roman numerals, chord names (sharps only), root-position voicings with the root between C3 and B3, common
progressions, and `progressionContent`, which lays chords back to back as notes plus chord **labels**. A note
clip's content may carry `labels` (chord name + beat in the source loop); split/duplicate copy them, shortening the
loop drops those past its end, clearing removes them, and `storage.ts` saves and validates them. `clipLabels`
(`timeline-view.ts`) places them across repeats for `ClipBlock`. The chord builder (`ChordBuilder.svelte`) makes a
clip at the playhead's bar on the selected track; "Save as pad" adds to `song.chordPads` (`setChordPads`, undoable).

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
