# Persistence and export

**Built?** No. Planned design, 2026-10-03. Rewrite this against the code once it exists.

## What it owns

Everything that leaves memory: user settings (theme, mode, key bindings, layout preset),
autosave of the current song, saving and opening project files, custom sample storage, and
exporting audio and MIDI.

## How it works

- **Settings** are small and go in `localStorage`, with a version number so old settings can
  be upgraded instead of crashing the app.
- **Autosave and custom samples** go in IndexedDB (browser storage that can hold audio files).
  Autosave runs a few seconds after each change, so closing the tab never loses work.
- **Project file**: the song timeline as JSON (`.ajsong.json`), with a format version.
  Custom samples used by the song are bundled alongside it (format decided in the project-file issue).
- **WAV**: offline render from the audio engine, encoded to 16-bit WAV in the browser.
- **MP3/OGG**: browser support for encoding differs. OGG/Opus may be possible through the
  browser's `MediaRecorder`; MP3 needs an encoder library (an open-source one such as
  lamejs, licence to be verified in the issue). Decided in the export issue, not assumed here.
- **MIDI**: notes per track to a standard `.mid` file (an open-source MIDI writer library,
  chosen in the issue), with General MIDI instrument numbers where one fits.

## Invariants

- A file this app saved can always be opened by a later version of the app.
- Export never silently drops tracks or notes. Anything it can't export (e.g. theremin glides
  in MIDI) is named in a message.

## Traps

- Browsers may clear IndexedDB under storage pressure. Ask for persistent storage
  (`navigator.storage.persist()`) and tell the user to also save project files.
