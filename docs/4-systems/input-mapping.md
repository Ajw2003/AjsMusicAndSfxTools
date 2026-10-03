# Input mapping

**Built?** No. Planned design, 2026-10-03. Rewrite this against the code once it exists.

## What it owns

Turning raw input (computer-keyboard keys, mouse, touch, pen) into note events for the audio
engine, and letting the user rebind keys. It also owns the two built-in layout presets.

## How it works

- A **binding map** connects a physical key (`KeyboardEvent.code`, e.g. `KeyA`) to an action:
  play a note offset from the current octave, shift octave up/down, sustain, etc.
- `event.code` (physical key position), not `event.key` (the letter typed), so a layout works the
  same on QWERTY, AZERTY and others.
- Two presets ship (decided 2026-10-03):
  - **Two-row piano**: `A S D F G H J K L` = white keys, `W E T Y U O P` = black keys,
    `Z`/`X` = octave down/up. The same layout most music software uses.
  - **Full keyboard, three rows**: the Q, A and Z rows each play a different octave.
- The user can rebind any key from a settings screen ("press the key you want"), and conflicts
  are shown instead of silently overwritten. Bindings are saved (see persistence).
- Mouse/touch use Pointer Events, so mouse, touch and pen share one code path. Dragging across
  keys glides from note to note (needed for the stylophone).
- Every on-screen key shows its note name and its bound computer key.

## Invariants

- Key auto-repeat (holding a key) never re-triggers a note.
- Losing window focus releases every held note.
- Shortcuts don't swallow keys a screen reader or the browser needs (Tab, Escape, arrows in
  menus). Note keys only play when focus is on the keyboard area or no text field is focused.

## Traps

- `keydown` for a held key repeats; check `event.repeat`.
- Some key combos are reserved by the browser or OS (Ctrl+W, Alt+F4). Don't offer them as bindings.
