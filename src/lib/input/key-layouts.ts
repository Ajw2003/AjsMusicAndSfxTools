/** Identifier for a computer-keyboard note layout. */
export type LayoutId = "piano" | "full";

/** Maps physical keys to notes, plus the octave shift keys. */
export interface KeyLayout {
  id: LayoutId;
  name: string;
  /** KeyboardEvent.code -> semitone offset from the layout's base C. */
  notes: Readonly<Record<string, number>>;
  octaveDownCode: string;
  octaveUpCode: string;
}

function row(codes: string[], start: number): Record<string, number> {
  return Object.fromEntries(codes.map((code, i) => [code, start + i]));
}

// Layouts use KeyboardEvent.code (physical position) so they work on any
// keyboard language.
/** All available layouts, in display order. */
export const KEY_LAYOUTS: readonly KeyLayout[] = [
  {
    id: "piano",
    name: "Two-row piano",
    notes: {
      KeyA: 0,
      KeyW: 1,
      KeyS: 2,
      KeyE: 3,
      KeyD: 4,
      KeyF: 5,
      KeyT: 6,
      KeyG: 7,
      KeyY: 8,
      KeyH: 9,
      KeyU: 10,
      KeyJ: 11,
      KeyK: 12,
      KeyO: 13,
      KeyL: 14,
      KeyP: 15,
      Semicolon: 16,
    },
    octaveDownCode: "KeyZ",
    octaveUpCode: "KeyX",
  },
  {
    id: "full",
    name: "Full keyboard, three rows",
    notes: {
      ...row(
        [
          "KeyZ",
          "KeyX",
          "KeyC",
          "KeyV",
          "KeyB",
          "KeyN",
          "KeyM",
          "Comma",
          "Period",
          "Slash",
        ],
        0,
      ),
      ...row(
        [
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyF",
          "KeyG",
          "KeyH",
          "KeyJ",
          "KeyK",
          "KeyL",
          "Semicolon",
        ],
        12,
      ),
      ...row(
        [
          "KeyQ",
          "KeyW",
          "KeyE",
          "KeyR",
          "KeyT",
          "KeyY",
          "KeyU",
          "KeyI",
          "KeyO",
          "KeyP",
        ],
        24,
      ),
    },
    octaveDownCode: "Minus",
    octaveUpCode: "Equal",
  },
];

/** Look up a layout by id; throws if unknown. */
export function getLayout(id: LayoutId): KeyLayout {
  const layout = KEY_LAYOUTS.find((l) => l.id === id);
  if (!layout) throw new Error(`Unknown key layout: ${id}`);
  return layout;
}

const PUNCTUATION: Readonly<Record<string, string>> = {
  Semicolon: ";",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Minus: "-",
  Equal: "=",
};

/** Short human label for a KeyboardEvent.code, e.g. "KeyA" -> "A". */
export function keyLabel(code: string): string {
  if (code in PUNCTUATION) return PUNCTUATION[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return code;
}
