# Plan: chiptune song prototype

**Goal (owner's words, 2026-10-03):** "a usable prototype worth showing where I can actually make a
song with even one type of sound, i.e. only chiptune first."

**Done when:** on the live site, on desktop and phone, someone can: start audio, play chiptune notes
by mouse/touch and computer keys, record a 4-bar loop on one track, add more tracks with different
chiptune sounds and record over the loop, hear them play together, undo a take, reload the page and
still have the song, and download a WAV of it.

## Shape: a loop-based song builder

A song is one loop (1–8 bars, default 4) that repeats. It has tracks; each track is one chiptune
sound. While the loop plays you arm a track and record; notes you play land in that track and play
back on the next pass (like a loop pedal). This is the smallest thing that makes a real song, and it
is the M5 "loop mode" design from `docs/4-systems/song-timeline.md`, so nothing is throwaway.

## Modules (all under `src/lib/`)

| Module | Owns | Tested by |
|---|---|---|
| `audio/engine.ts` | The only Tone.js user. `start()` on first gesture; master volume + limiter; one voice per track; `noteOn/noteOff/releaseAll`; transport (bpm, loop, play/stop); metronome click; `renderWav()` via `Tone.Offline` | Browser run |
| `audio/chiptune.ts` | Chiptune presets as plain data: Square lead, Pulse 25%, Triangle bass, Noise drums | Unit |
| `audio/wav.ts` | Encode an `AudioBuffer`-like object to 16-bit PCM WAV bytes | Unit |
| `input/key-layouts.ts` | Two presets (two-row piano, three-row full) mapping `KeyboardEvent.code` → semitone offset, plus octave keys | Unit |
| `song/song.ts` | Song data (beats, not seconds), commands with undo/redo, quantize, JSON (de)serialise with a version | Unit |
| `song/storage.ts` | Autosave to `localStorage`, load with fallback, project file download/open | Unit (parse) |

UI (`src/components/`): `StartOverlay`, `TransportBar` (play/stop, record, BPM, bars, metronome,
quantize, undo/redo, export), `TrackList` (add track by sound, select/arm, mute, volume, clear,
delete), `LoopView` (read-only grid of each track's notes, coloured per track, playhead),
`Keyboard` (2 octaves on screen, glow, note name + bound key labels, octave shift, layout picker).

## Issues this covers

#7 start audio · #8 on-screen keyboard · #9 pointer play · #10 computer keys · #11 octave ·
#12 labels · #13 no stuck notes · #14 volume + limiter · #25 chiptune · #43 song model + undo ·
#44 tempo + metronome · #45 record · #46 playback · #47 loop layering · #48 quantize ·
#49 track list · #50 autosave · #52 project files · #53 WAV export · #58 (read-only part of the piano roll).

## Build order (one builder per chunk, each merged and checked before the next)

1. Pure logic: `chiptune.ts`, `wav.ts`, `key-layouts.ts`, `song/song.ts`, `song/storage.ts` + tests.
2. Audio engine + Start overlay + Keyboard: playable chiptune keyboard.
3. Transport, recording, track list, loop view, autosave, export.
4. Browser check with Playwright (headless Chromium): play keys, record, export WAV with non-silent
   samples, reload restores song, no console errors, phone-sized screenshot.

## Rules every chunk follows

- Accessibility conventions from the landing page: every control is a real `<button>`/`<input>`
  with a label, visible focus, keyboard reachable; note keys don't fire while typing in a field.
- Calm UI: one screen, dark theme by default using the existing CSS variables.
- No new dependencies beyond `tone` (decided 2026-10-03).
