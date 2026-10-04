# Plan: usability pass for dyslexia and ADHD (#84)

**Asked for (owner, 2026-10-03):** "do a second pass on the UI for usability, especially for those with
disabilities like dyslexia and ADHD." Then, 2026-10-04: it comes **next**, before phase C (audio files).

**Status:** approved by the owner 2026-10-04 ("the rest is good"); being built. Steps are issues #86–#90.

**Owner's answers (2026-10-04):** the five steps, all four fonts and the draft names are fine; yes to
`@axe-core/playwright`; the owner has both dyslexia and ADHD and will try it themselves.

## What the app looks like today (measured 2026-10-04)

Screenshots of every screen as it is now: `docs/generated/usability/before-*.png` (desktop 1280 px and phone
390 px; start, first screen, recording, everything open).

- **Too much at once.** The first screen shows about 30 controls before you reach the piano keys. With a clip
  selected and the chord builder open it's about 45, plus the keys. Every setting is always visible: tempo,
  quantize, metronome, snap, zoom, loop bars, new clip length.
- **On a phone the music is hidden.** The first phone screen is 12 settings controls stacked up, and the
  timeline (the actual song) is mostly behind the keyboard. The page with everything open is 2,630 px tall.
- **Recording is easy to miss.** While recording, the only signs are a thin outline on the Record button and a
  small grey "Count-in…".
- **Small and dense text.** 36 pieces of visible text are under 14 px on desktop, 54 on a phone with the chord
  builder open. Lines use the browser's default spacing; the font is whatever the system gives.
- **Jargon and bare numbers.** "BPM", "Quantize 1/4 beat (1/16 note)", "Snap", "Transpose (semitones)",
  "Volume (dB)", "Loop length (beats)". The clip inspector is seven number boxes in a row.
- **Wrapping on phones.** The chord builder's per-chord buttons wrap so that "→" sits alone on a second line,
  and saved chord pads push the keyboard area taller.

## What good looks like

For **dyslexia**: text that is easy to decode, meaning a clear font (with a choice), comfortable size and
spacing, short plain words, no all-caps or italics carrying meaning, left-aligned text, and an icon *and* a
word on buttons, so nobody has to rely on reading alone.

For **ADHD**: fewer things competing for attention, meaning one obvious next step, related controls grouped
and the rest tucked away until wanted, state you can't miss (especially recording), everything in the same
place every time, nothing moving that doesn't need to, and mistakes that are cheap (Undo always close).

Both groups benefit from the same thing: **less on screen, said more plainly.**

## The changes, in five steps

Each step is one sub-issue of #84, built and browser-checked on its own, with before/after screenshots.

### 1. A calmer layout (biggest change) — #86

- **Top bar = the four things you always need:** Play/Pause, Back to start, Record, and the position, larger
  than today. Undo/Redo stay next to them.
- **Everything else moves into labelled groups that start closed:** *Song* (tempo, metronome, count-in),
  *Recording* (quantize, new clip length), *Timeline* (zoom, snap, loop bars). Each opens with one tap and
  remembers whether you left it open.
- **One panel at a time** below the timeline: Clip, Track settings or Chord builder. Opening one closes the
  others, so the page never grows into a wall.
- **Phone:** the timeline comes straight after the top bar, so the song is visible without scrolling. The
  keyboard dock gets a "hide keyboard" toggle, and chord pads become one scrollable row.

### 2. Plain words — #87

A rename pass on every visible label, with the old term kept where it's the standard musical word and is
explained once. A first draft:

| Today | Proposed |
|---|---|
| BPM | Tempo (beats per minute) |
| Quantize: 1/4 beat (1/16 note) | Tidy timing: Off / Light / Strong / On the beat |
| Snap: Beat / Bar | Line clips up to: Nothing / Beats / Bars |
| Loop from bar 1 to bar 4 | Repeat bars 1 to 4 |
| Transpose (semitones) | Higher / lower (steps), with − and + buttons |
| Volume (dB) | Volume, as a slider |
| Length / Loop length (beats) | Length and Repeats every, in bars and beats |
| "Pick a sound, press Record, play along…" (one long line) | Three short numbered steps, which can be hidden |

### 3. Reading comfort settings — #88

A small **Reading** setting, saved in the browser:

- **Font:** System, Atkinson Hyperlegible, Lexend, OpenDyslexic. All are free and open (SIL OFL) and are
  bundled with the app, so no outside service is involved.
- **Text size:** Normal / Large / Larger.
- **Spacing:** Normal / Relaxed. Relaxed uses line height 1.5 and wider letter and word spacing, matching
  WCAG 1.4.12.
- In every mode: no text under 14 px, and no all-caps or italics used for meaning.

### 4. Focus aids — #89

- **Recording you can't miss:** a red bar across the top saying "Recording into Verse — press Record to
  stop", and a large 4-3-2-1 count-in.
- **Undo right where the mistake happened:** after Delete clip or Delete track, a short "Deleted. Undo"
  message with the button in it. It stays until you dismiss it; no timers.
- **Short, dismissable hints** the first time you open the chord builder or the timeline, never shown again
  once closed.
- **Same place every time:** fixed positions for the top bar and panels, and no layout jumps when a panel
  opens.

### 5. Check it — #90

- Before/after screenshots of every screen, desktop and phone, in `docs/generated/usability/`.
- `npm run test:e2e` updated for the new labels and layout, still covering keyboard-only use and phones.
- An automated accessibility scan (axe) in the browser checks. It would be a new dev dependency
  (`@axe-core/playwright`, open source), so it needs a yes first.
- Best of all, a try-out by someone with dyslexia or ADHD. Only you can arrange that.

## How this fits the other M4 issues

This pass covers layout, words, reading comfort and focus aids. It deliberately leaves themes (#35), the
Simple/Advanced switch (#36), note-label options (#37), reduced motion (#38) and screen-reader announcements
(#39) to their own issues. Step 1's closed-by-default groups are built so Simple mode (#36) can later hide them
entirely.

## Questions for the owner

1. Is the five-step shape right? Is anything missing or unwanted?
2. Fonts: are all four OK, or a shorter list?
3. Renaming changes words you may already know. Are the proposed names OK as a first draft?
4. May I add `@axe-core/playwright` for the automated accessibility scan?
5. Can someone with dyslexia or ADHD try it once steps 1–4 are in?

## Order and size

Steps 1 and 2 first, since they change the most for everyone. Then 3, then 4, with step 5 running throughout.
Each step is a separate commit and browser check. I'll open one pull request at the end, or one per step if
you'd rather test as it goes.
