# Usability pass: screenshots and accessibility scan

Plan: [docs/plans/usability-pass.md](../../plans/usability-pass.md). Each screen is shown at desktop (1280 px)
and phone (390 px) width.

## Screenshots

| Files | Step | What they show |
| --- | --- | --- |
| `before-*-1-start`, `2-first-screen` | Before | The start overlay and the first screen as they were. |
| `before-*-3-recording`, `4-everything-open` | Before | Recording, and every panel open at once. |
| `after-1-*` | 1 (#86) | Calmer layout: first screen, and the Song panel opened. |
| `after-2-*` | 2 (#87) | Plain labels: Clip, Recording, Song and Timeline panels. |
| `after-3-*` | 3 (#88) | Reading settings: default, Lexend, Atkinson large, and OpenDyslexic + Larger + Relaxed. |
| `after-4-*` | 4 (#89) | Focus aids: count-in, recording bar, Deleted/Undo message, first-time hint. |

Step 5 (#90) changed no styling, so it has no new screenshots.

## Accessibility scan (axe, step 5, #90)

`npm run test:e2e` scans every screen with axe-core (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa). Serious or
critical findings fail the run; moderate and minor ones are only printed. Final run:

| Screen | Width | Serious | Critical | Moderate | Minor |
| --- | --- | --- | --- | --- | --- |
| start overlay | desktop | 0 | 0 | 0 | 0 |
| start overlay | phone | 0 | 0 | 0 | 0 |
| first screen | desktop | 0 | 0 | 0 | 0 |
| first screen | phone | 0 | 0 | 0 | 0 |
| first-time hint | desktop | 0 | 0 | 0 | 0 |
| first-time hint | phone | 0 | 0 | 0 | 0 |
| Track panel | desktop | 0 | 0 | 0 | 0 |
| Track panel | phone | 0 | 0 | 0 | 0 |
| Clip panel | desktop | 0 | 0 | 0 | 0 |
| Clip panel | phone | 0 | 0 | 0 | 0 |
| Chord builder panel | desktop | 0 | 0 | 0 | 0 |
| Chord builder panel | phone | 0 | 0 | 0 | 0 |
| Recording panel | desktop | 0 | 0 | 0 | 0 |
| Recording panel | phone | 0 | 0 | 0 | 0 |
| Timeline panel | desktop | 0 | 0 | 0 | 0 |
| Timeline panel | phone | 0 | 0 | 0 | 0 |
| Song panel | desktop | 0 | 0 | 0 | 0 |
| Song panel | phone | 0 | 0 | 0 | 0 |
| Reading panel | desktop | 0 | 0 | 0 | 0 |
| Reading panel | phone | 0 | 0 | 0 | 0 |
| Save & export panel | desktop | 0 | 0 | 0 | 0 |
| Save & export panel | phone | 0 | 0 | 0 | 0 |
| count-in | desktop | 0 | 0 | 0 | 0 |
| count-in | phone | 0 | 0 | 0 | 0 |
| recording bar | desktop | 0 | 0 | 0 | 0 |
| recording bar | phone | 0 | 0 | 0 | 0 |
| deleted message | desktop | 0 | 0 | 0 | 0 |
| deleted message | phone | 0 | 0 | 0 | 0 |
| OpenDyslexic, Larger, Relaxed | desktop | 0 | 0 | 0 | 0 |
| OpenDyslexic, Larger, Relaxed | phone | 0 | 0 | 0 | 0 |

All 28 checks passed with no findings at any level. The scanner was confirmed to work by running it on a page with a known bad button and low contrast text; it reported both.

## Phone fix after the owner's report (#93, 2026-10-04)

| File | Shows |
|---|---|
| `before-6-phone-owner-report.jpg` | The owner's phone: keyboard covers the timeline, drum names break letter by letter |
| `before-6-phone-412-larger.png` | Same problem reproduced at 412 px with Larger text |
| `after-6-phone-412-larger.png` | After: the track shows above the keyboard; tips start hidden on phones |
| `after-6-phone-drums-412-large.png` | After: drum keys named once each, Kick / Snare / Hat, whole words |
| `after-6-phone-drums-360-large.png` | After: the same on a 360 px phone |
| `after-6-wide-drums-980.png` | After: the phone's "desktop site" width (980 px), drums with computer-key letters |
