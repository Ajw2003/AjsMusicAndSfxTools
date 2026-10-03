# Instruments

**Built?** No. Planned design, 2026-10-03. Rewrite this against the code once it exists.

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
