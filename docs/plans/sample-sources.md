# Plan: free sample packs for piano, guitars, bass and drums (#17) — candidates, awaiting the owner

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

## Suggested picks (if the licences check out)

- **Piano:** Salamander Grand Piano, a handful of notes at 2–3 velocities, compressed for the web.
- **Acoustic guitar, electric guitar, bass:** tonejs-instruments, *after* checking the Iowa and Karoryfer
  licences it builds on.
- **Drums:** Open Source Drumkit (public domain) first, Salamander Drumkit as the fallback.

## Questions for the owner

1. Is credit-required (CC BY) fine for samples? It only means a line in CREDITS.md and the About panel.
2. Is share-alike (CC BY-SA) acceptable for the drum samples, if the public-domain kit falls through?
3. Size budget per instrument for the first load. Suggested: under 2 MB each, loaded only when picked (#19).

## Next step once answered

Download each pack, read the licence file inside it, record author, link and licence in `CREDITS.md`, then
pick and trim notes. That is the rest of #17; #19–#24 build on it.
