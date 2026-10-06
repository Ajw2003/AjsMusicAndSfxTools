# Plan: MP3 and OGG export (#54) — recommendation, awaiting the owner

Status: research done 2026-10-06, nothing built. **Needs the owner's yes** because it adds a dependency
(house rule: ask before adding any dependency).

## What browsers give for free

- No browser can encode MP3 by itself (WebCodecs has no MP3 encoder).
- Chrome, Edge, Firefox and Safari can encode **Opus** through WebCodecs `AudioEncoder`. Opus in an Ogg
  file is a `.ogg` / `.opus` file. It still needs a small piece of code to wrap the audio in an Ogg file.
- `MediaRecorder` can't be used: it records in real time, while export renders faster than real time, and
  its output format differs per browser.

## Options looked at

| Option | Licence | What it adds | Notes |
|---|---|---|---|
| **mediabunny** 1.61.3 + **@mediabunny/mp3-encoder** 1.61.3 | MPL-2.0 (LAME inside is LGPL) | MP3 via a LAME WASM build (~130 kB gzipped, in a worker); Ogg/Opus via the browser's own encoder; tree-shakable, no dependencies | Updated 2026-10-05; one library covers both formats. LAME asks for a credit with a link (goes in CREDITS.md and the About panel). |
| lamejs 1.2.1 | LGPL-3.0 | MP3 only, pure JavaScript | Last release 2021; known "MPEGMode is not defined" bug needs a fork. |
| @breezystack/lamejs 1.2.7 | LGPL-3.0 | MP3 only, fixed fork of lamejs | Updated 2025-01; slower than WASM; no Ogg. |
| libvorbis WASM builds (libvorbis.js, sl-web-ogg) | BSD-style (Xiph) | Ogg Vorbis | Little-used packages; Opus via the browser is better quality per byte. |

## Recommendation

**mediabunny + @mediabunny/mp3-encoder.** One maintained, open-source family for both formats. MP3 from
LAME, Ogg with Opus from the browser's own encoder. The app keeps rendering WAV-quality audio offline as it
does now (`renderWav` in `src/lib/audio/engine.ts`); the encoder only converts that audio.

**Licence check.** MPL-2.0 and LGPL are fine for an MIT app that ships them unchanged, as separate files.
LAME and mediabunny get credited in `CREDITS.md`.

## Risks to check on the owner's PC

- Windows Media Player (the issue's "done when") plays MP3 everywhere. Ogg/Opus plays in the Windows 10/11
  player only with Microsoft's **Web Media Extensions**, which are usually pre-installed. Not checked here
  (no Windows machine). If Ogg doesn't play there, MP3 still covers the done-when.
- Bundle size: the MP3 encoder (~130 kB gzipped) loads only when MP3 export is first used.

## If approved: steps (each a sub-issue of #54)

1. Add the two packages (pinned) and credits; an `encodeAudio(channels, sampleRate, "mp3" | "ogg")` module
   with unit tests that decode the result's header.
2. Format choice (WAV / MP3 / OGG) in Save & export, with plain words for each.
3. Browser check: download each format, check the file starts with the right header (`ID3`/MP3 frame sync,
   `OggS`) and is the expected length.

## Sources

- npm registry, read 2026-10-06 (`npm view`): versions, licences, dates above.
- mediabunny README (npm): "Read _and_ write MP4, MOV, WebM, MKV, HLS, WAVE, MP3, Ogg, ADTS, FLAC, MPEG-TS".
- @mediabunny/mp3-encoder README (npm): WASM build of LAME 3.100, ~130 kB gzipped, LAME licensed LGPL.
