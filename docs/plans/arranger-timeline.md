# Plan: arranger timeline, chord builder, audio clips

**Asked for (owner, 2026-10-03):** "traditional timeline controls like video editing software has for its
audio tracks so we can easily drag and layer audio as well as single chord progressions." Follow-up answers:

- Loops become clips, and a clip's length and other attributes must be easy to edit right there.
- "Audio" means all three: note clips recorded in the app, imported audio files, and microphone recordings.
- Chords: a chord builder whose chords can be saved as one-key playable chords, to streamline making music.
- Song length: unlimited.

## Shape

A song is a set of tracks laid out left to right on a timeline that grows as you add clips. Each track
holds **clips**. A clip has a start, a length, and content that repeats to fill the length:

- **Note clip**: notes in beats, recorded with the existing loop recorder or made by the chord builder.
- **Audio clip**: a reference to an imported or recorded sound file, with an offset into the file.

Note tracks play an instrument; audio tracks play audio clips. Recording stays loop-based: you select a
clip (or make a new empty one at the playhead) and record into it in loop mode, which is the current UI.

## What "easy to edit" means for clips

On the timeline: drag to move (snaps to beat/bar, snap can be turned off), drag the right edge to
lengthen (content repeats) or shorten, drag the left edge to trim the start. Duplicate, split at
playhead, delete, copy/paste. A **clip inspector** with number fields for start, length, loop length,
transpose, volume and colour, so every drag has a typed, keyboard-reachable equivalent. That's an
accessibility rule as well as convenience.

## Phases (each merged and live before the next)

| Phase | What you can do after it | Issues |
|---|---|---|
| A. Timeline with note clips | Arrange recorded loops as clips on a growing timeline, move/stretch/trim/split/duplicate, zoom and scroll, play from the playhead, optional loop region, export the whole song | A1–A5 |
| B. Chord builder + chord pads | Pick a key, build a progression from suggested chords, turn it into a clip; save chords as one-key pads you play live and record | B1–B2 |
| C. Audio clips | Import WAV/MP3/OGG onto audio tracks, see waveforms, arrange like note clips, hear them in playback and export, saved in project files | C1–C3 |
| D. Microphone | Record your voice/instrument into an audio clip with a count-in | D1 |

## Data change

`Song` becomes version 2: `tracks[].clips[]` instead of `tracks[].notes`, plus `kind: "notes" | "audio"`
on tracks, and a saved chord-pad set. Version 1 songs (autosave and project files) are upgraded on load:
each track's notes become one clip at bar 1 whose length is the old loop length. Nothing already made is lost.

Audio files are stored in the browser's IndexedDB (localStorage is too small) and embedded in project
files as base64, so one `.ajsong.json` file still carries everything. No new dependencies are needed:
decoding uses the browser's own `decodeAudioData`, recording uses `MediaRecorder`.

## Roadmap effect

This adds a milestone, **M9: Arranger**. It's recorded in the roadmap and in Decisions.
