# Systems (tier 4)

> **Status on 2026-10-03: partly built for the chiptune prototype (#68).** Each document below started
> as the agreed design; its "Built?" line says what exists now and where it differs,
> citing the code as `file:line`. When a system is fully built, its body is rewritten to match.

A system is something where, if it is wrong, the product stops working.

| System | Owns | Doc | Built? |
|---|---|---|---|
| Audio engine | Turning "play note X on instrument Y" into sound, with low latency | [audio-engine.md](audio-engine.md) | Mostly |
| Instruments | The 8 default instruments, sample loading, custom samples | [instruments.md](instruments.md) | Chiptune only |
| Input mapping | Computer keys, mouse, touch and pointer → note on/off; rebinding | [input-mapping.md](input-mapping.md) | Partly |
| Song timeline | The note-event data that recording, looping, piano roll and step sequencer all share | [song-timeline.md](song-timeline.md) | Loop mode |
| Persistence and export | Settings, autosave, project files, WAV/MP3/OGG/MIDI export | [persistence-and-export.md](persistence-and-export.md) | Partly |

## Considered and left out

- **Themes / visual style.** Important to the feel of the app, but if a theme is wrong the app
  still plays. Themes are CSS variables, covered in the landing doc's conventions.
- **Accessibility.** Not a system. It's a rule every system and screen follows. See the
  conventions in [../1-landing/README.md](../1-landing/README.md#conventions).
- **Metronome.** A small feature built on the audio engine's clock, not its own system.
