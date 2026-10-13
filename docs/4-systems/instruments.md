# Instruments

**Built?** Partly, 2026-10-13. One catalogue, `CHIPTUNE_PRESETS` in `src/lib/audio/chiptune.ts`, holds
seven generated sounds (square, pulse 25%, pulse 12.5%, saw, triangle bass, pulse bass, noise drums) and four
sampled ones (acoustic guitar, electric guitar, electric bass, upright bass; #104). Noise drums pick kick/snare/hat
by pitch (`src/lib/audio/drums.ts:4`: below C4 kick, C4–B4 snare, C5 and up hat). Piano and sampled drums not yet.

Sampled sounds: a preset with `wave.kind: "sampled"` names a folder under `public/samples/`, a note range
(`lowMidi`–`highMidi`, one file per semitone, `As1.mp3` for A#1, see `sampleFileName`) and a `gainDb` that brings the
files to the -3 dBFS median peak the old set had. The engine's `buildSampledVoice` (`src/lib/audio/engine.ts`) wraps
a Tone.js `Sampler`, which stretches the nearest file only for notes outside the range. Releases are long
(1.5–2.5 s), so a note rings on after the key lifts, as a string does (#109). Sources and the measurements that
picked them: Decisions, 2026-10-13 "Plucked guitar and bass recordings". The files download when a track first uses the
sound; until then notes are skipped and a "Loading … recordings" notice shows; a failed download shows a
"Couldn't load" notice and that track stays silent (no generated fallback yet, see #19). WAV export waits for
the recordings before rendering.

## What it owns

The catalogue of instruments: each one's id, name, colour, how it makes sound (sampled or
generated), its playable range and its default settings. It loads samples on demand and
handles custom user samples. It hands the audio engine a ready-to-play Tone.js source.

## How it works

Hybrid sound sources (decided 2026-10-03, see [Decisions](../6-decisions/Decisions.md)):

| Instrument | Source | Notes |
|---|---|---|
| Piano | Sampled | Candidate: Salamander Grand Piano. Licence to verify in the sourcing issue. |
| Acoustic guitar | Sampled | Candidate source to pick in the sourcing issue |
| Electric guitar | Sampled | Candidate source to pick in the sourcing issue |
| Bass | Sampled | Candidate source to pick in the sourcing issue |
| Drums | Sampled, one sample per key (kick, snare, hats…), not pitched | Candidate source to pick in the sourcing issue |
| Chiptune | Generated: square/pulse/triangle/noise waves | Retro game-console sound |
| Stylophone | Generated: buzzy square-ish mono synth, no velocity | Played by dragging along the keys, like a stylus |
| Theremin | Generated: sine with vibrato, continuous pitch | Played by pointer position (x = pitch, y = volume), not by keys |

- Instruments are described by plain data (`InstrumentDefinition`), so adding one doesn't
  touch engine code.
- Samples are fetched only when an instrument is first chosen, with a visible loading state.
  The app must stay playable (on a generated instrument) while samples load.
- Every sample pack's licence and author are listed in `CREDITS.md`. A pack with no clear
  free licence doesn't go in.

## Invariants

- Only free-licensed samples (CC0, CC-BY or similar) are shipped, each credited.
- A missing or failed sample download shows an error and falls back; it never hangs silently.

## Traps

- Sample packs are big. Don't bundle them into the JavaScript; serve them as static files
  and cache them for offline use (M8).
