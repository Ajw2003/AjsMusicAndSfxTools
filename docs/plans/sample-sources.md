# Plan: free sample packs for piano, guitars, bass and drums (#17) — chosen 2026-10-06

Status: first research pass 2026-10-06. **Candidates, not choices.** Every licence must be read at its
source page and in the downloaded files before anything ships (the issue's own rule). Rows marked
*second-hand* were seen only in search summaries; this sandbox's network blocks some sites (e.g.
freepats.zenvoid.org).

## Candidates

| Instrument | Pack | Licence (as reported) | How checked | Notes |
|---|---|---|---|---|
| Piano | Salamander Grand Piano V3 (Alexander Holm) | CC BY 3.0 | second-hand | 16 velocity layers, sampled every minor third; widely used with Tone.js. Archive: https://archive.org/details/SalamanderGrandPianoV3 |
| Piano, acoustic guitar, electric guitar, bass | tonejs-instruments (nbrosowsky) | "Samples: CC-by 3.0" | repo README read | Ready-made per-note files for Tone.js `Sampler`. Its source list names VSCO 2 (piano), University of Iowa (acoustic guitar) and Karoryfer (electric guitar, bass). Each upstream licence still needs checking, since a repackager can't relicense. https://github.com/nbrosowsky/tonejs-instruments |
| Electric guitar, bass | Karoryfer Samples (Emilyguitar, Growlybass, Pastabass, Fashionbass) | CC BY 3.0 | second-hand | SFZ multisamples; would need trimming to a few notes per instrument for the web. |
| Drums | Salamander Drumkit (Alexander Holm) | CC BY-SA 3.0 | repo README read | Share-alike covers changed samples and new sample libraries, not music made with them. Trimming samples for the web may count as changing them, so our trimmed copies would be CC BY-SA too. https://github.com/endolith/Salamander-Drumkit |
| Drums | Open Source Drumkit (Real Music Media) | public domain | second-hand | Kick, snare, hi-hat, toms, cymbals, many velocity layers, SFZ. Simplest licence if confirmed. |
| All | FreePats project | mixed (CC0 / GPL per set) | not reached (blocked here) | Worth checking from the owner's PC: has guitars, bass and drum kits. |

## Owner's answers (2026-10-06)

Credit-required (CC BY) packs: yes. Share-alike (CC BY-SA) for drums: yes, as the fallback. Size: under 2 MB
per instrument, loaded only when picked (#19).

## Chosen, with the licence read at the source

| Instrument | Pack | Licence | Where it was read |
|---|---|---|---|
| Piano | Salamander Grand Piano V3, Alexander Holm | CC BY 3.0 | `LICENSE` in https://github.com/sfzinstruments/SalamanderGrandPiano (full CC BY 3.0 text). MP3s per minor third: `salamander/` in https://github.com/Tonejs/audio (30 files, 2.01 MB). |
| Acoustic guitar | tonejs-instruments `guitar-acoustic` | CC BY 3.0 | README of https://github.com/nbrosowsky/tonejs-instruments ("Samples: CC-by 3.0"); its `sample-source-info.txt` names Iowa, whose page says the recordings "may be downloaded and used for any projects, without restrictions" (https://theremin.music.uiowa.edu/MIS.html). 37 MP3s, 6.97 MB. |
| Electric guitar | tonejs-instruments `guitar-electric` | CC BY 3.0 | Same README; source Karoryfer, whose page says "Most of these samples have a CC-BY attribution" and asks for credit when redistributing them as samples (https://www.karoryfer.com/karoryfer-samples). 17 MP3s, 1.75 MB. |
| Bass | tonejs-instruments `bass-electric` | CC BY 3.0 | Same as electric guitar. 17 MP3s, 5.05 MB. |
| Drums | Salamander Drumkit, Alexander Holm | CC BY-SA 3.0 | Author's README quoted in https://github.com/endolith/Salamander-Drumkit: "The 'share-alike' condition in the license only applies if you modify the samples themselves or create new sample libraries with them. Produced Music and other non-sample-library works can be licensed at will." |

**Not chosen: Open Source Drumkit.** Its download (https://github.com/crabacus/the-open-source-drumkit) has
no licence file, only a credit to Real Music Media, whose old site now hosts something unrelated. Only news
posts (KVR, rekkerd.org) call it "public domain", so the licence can't be verified at its source.

## Fitting the 2 MB budget

The Tone.js `Sampler` repitches between sampled notes, so each instrument keeps a subset of notes: piano every
other file (about 1 MB), acoustic guitar every third (about 2 MB), bass 6 or 7 of 17. These packs have one
loudness layer, not 2 or 3. Drums: one or two hits per drum from the Salamander WAVs, encoded to MP3.

## Still to check when each instrument is built (#20 to #24)

- Karoryfer doesn't say which of its libraries tonejs-instruments used; "most" are CC BY. Credit both.
- The Salamander Drumkit samples are on archive.org, which this cloud sandbox can't reach; download them from
  the owner's PC or another environment, and keep the licence text from inside the archive.
- Our trimmed drum files are CC BY-SA 3.0; say so next to them.
