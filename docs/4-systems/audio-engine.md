# Audio engine

**Built?** Mostly, 2026-10-03, for the chiptune prototype (#68): `AudioEngine` in `src/lib/audio/engine.ts:193`.
Differs from the design below: the transport counts in ticks (PPQ 192); muting works by not
scheduling a track (`setSong`, `engine.ts:296`), so live play ignores mute; count-in is
`playWithCountIn` (`engine.ts:374`); export is `renderWav` (`engine.ts:419`). Latency not measured yet (#15).

## What it owns

The one place that makes sound. It takes note events (`noteOn(instrumentId, midiNote, velocity)`,
`noteOff(...)`, and for the theremin a continuous `setPitch`) and turns them into audio through
Tone.js on the browser's Web Audio API. It also owns the master clock (tempo, transport) that
recording, looping and the metronome read from, and the master output that export captures.

It does **not** own which key maps to which note (input mapping), where samples come from
(instruments) or what a song contains (song timeline).

## How it works

- One shared `AudioContext`, created through Tone.js. Browsers refuse to start audio until the
  user clicks or presses a key, so the engine starts on the first user gesture and the UI
  shows a "click to start" prompt until then.
- Each instrument is a Tone.js source (`Sampler` for sampled instruments, `Synth`/`MonoSynth`/
  `PolySynth` for generated ones) wired into a per-instrument channel (volume, pan, effects),
  then into a master channel (limiter, master volume) and out.
- Live play triggers notes immediately (`triggerAttack` with no scheduled time). Playback of
  recorded songs is scheduled on `Tone.Transport`, so timing doesn't depend on the UI's
  frame rate.
- Export renders offline (`Tone.Offline`) from the song timeline, not by recording the speakers,
  so the exported file is exact and doesn't include clicks from the UI.

## Invariants

- Nothing outside this system creates audio nodes or calls Tone.js directly.
- Every `noteOn` gets a matching `noteOff`, including when the window loses focus mid-note
  (stuck notes are the classic failure).
- The master output has a limiter, so stacking many notes can't produce painful clipping.
- Live play latency target: under 30 ms from key press to sound on the owner's machine. This is
  the M1 acceptance number; it has not been measured yet.

## Traps

- Audio won't start without a user gesture. Don't try to start it on page load.
- `Tone.now()` vs `Transport` time: live notes use the first, song playback uses the second.
  Mixing them causes drift.
