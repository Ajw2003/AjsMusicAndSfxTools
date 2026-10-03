# Systems (tier 4)

> **Status on 2026-10-03: none of these systems exist in code yet.** Each document below is the
> agreed design, written before building so the issues have something to point at. Each one
> carries a "Built?" line; when a system is built, its doc is rewritten to describe the real
> code and cite it to `file:line`.

A system is something where, if it is wrong, the product stops working.

| System | Owns | Doc | Built? |
|---|---|---|---|
| Audio engine | Turning "play note X on instrument Y" into sound, with low latency | [audio-engine.md](audio-engine.md) | No |
| Instruments | The 8 default instruments, sample loading, custom samples | [instruments.md](instruments.md) | No |
| Input mapping | Computer keys, mouse, touch and pointer → note on/off; rebinding | [input-mapping.md](input-mapping.md) | No |
| Song timeline | The note-event data that recording, looping, piano roll and step sequencer all share | [song-timeline.md](song-timeline.md) | No |
| Persistence and export | Settings, autosave, project files, WAV/MP3/OGG/MIDI export | [persistence-and-export.md](persistence-and-export.md) | No |

## Considered and left out

- **Themes / visual style.** Important to the feel of the app, but if a theme is wrong the app
  still plays. Themes are CSS variables, covered in the landing doc's conventions.
- **Accessibility.** Not a system. It's a rule every system and screen follows. See the
  conventions in [../1-landing/README.md](../1-landing/README.md#conventions).
- **Metronome.** A small feature built on the audio engine's clock, not its own system.
