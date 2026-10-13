# Credits

Every third-party sound, sample pack and asset shipped with the app is listed here with its
author, source link and licence. Code dependencies are listed in `package.json` with their own licences.

Recorded instruments are note-by-note renders of two General MIDI soundfonts, published in the
midi-js-soundfonts collection. Files are shipped in `public/samples/` unchanged from that collection
(the app raises their volume in code). The source collection names the soundfonts and their licences
but not their authors.

| Asset           | Used for                                | Author                                                      | Source                                       | Licence      |
| --------------- | --------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- | ------------ |
| Acoustic guitar | Acoustic guitar sound, 49 notes (E2–E6) | FluidR3_GM soundfont ("acoustic_guitar_steel"), via gleitz  | https://github.com/gleitz/midi-js-soundfonts | CC BY 3.0    |
| Electric guitar | Electric guitar sound, 49 notes (E2–E6) | Musyng Kite soundfont ("electric_guitar_clean"), via gleitz | https://github.com/gleitz/midi-js-soundfonts | CC BY-SA 3.0 |
| Electric bass   | Electric bass sound, 40 notes (E1–G4)   | FluidR3_GM soundfont ("electric_bass_pick"), via gleitz     | https://github.com/gleitz/midi-js-soundfonts | CC BY 3.0    |
| Upright bass    | Upright bass sound, 40 notes (E1–G4)    | FluidR3_GM soundfont ("acoustic_bass"), via gleitz          | https://github.com/gleitz/midi-js-soundfonts | CC BY 3.0    |

The electric guitar files are share-alike: anyone who changes or redistributes those files must keep
CC BY-SA 3.0. Music made with them is not affected.

## Fonts

Bundled with the app (no outside service is used), selectable under Reading. Each ships as a
`@fontsource` npm package, pinned in `package.json`.

| Font                  | Used for                     | Author                                    | Source                                                          | Licence     |
| --------------------- | ---------------------------- | ----------------------------------------- | --------------------------------------------------------------- | ----------- |
| Atkinson Hyperlegible | Reading setting: Font choice | Braille Institute of America              | https://www.npmjs.com/package/@fontsource/atkinson-hyperlegible | SIL OFL 1.1 |
| Lexend                | Reading setting: Font choice | Bonnie Shaver-Troup, Thomas Jockin et al. | https://www.npmjs.com/package/@fontsource/lexend                | SIL OFL 1.1 |
| OpenDyslexic          | Reading setting: Font choice | Abelardo Gonzalez                         | https://www.npmjs.com/package/@fontsource/opendyslexic          | SIL OFL 1.1 |
