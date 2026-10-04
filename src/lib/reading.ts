import { loadUi, saveUi } from "./ui-storage";

export const FONTS = [
  { id: "system", label: "System" },
  { id: "atkinson", label: "Atkinson Hyperlegible" },
  { id: "lexend", label: "Lexend" },
  { id: "opendyslexic", label: "OpenDyslexic" },
] as const;
export const TEXT_SIZES = [
  { id: "normal", label: "Normal" },
  { id: "large", label: "Large" },
  { id: "larger", label: "Larger" },
] as const;
export const SPACINGS = [
  { id: "normal", label: "Normal" },
  { id: "relaxed", label: "Relaxed" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];
export type TextSizeId = (typeof TEXT_SIZES)[number]["id"];
export type SpacingId = (typeof SPACINGS)[number]["id"];

export interface Reading {
  font: FontId;
  textSize: TextSizeId;
  spacing: SpacingId;
}

const KEYS = {
  font: "ajs-music.ui.font",
  textSize: "ajs-music.ui.text-size",
  spacing: "ajs-music.ui.spacing",
} as const;

function pick<T extends { id: string }>(
  options: readonly T[],
  saved: string | null,
): T["id"] {
  return options.find((o) => o.id === saved)?.id ?? options[0].id;
}

export function loadReading(): Reading {
  return {
    font: pick(FONTS, loadUi(KEYS.font)),
    textSize: pick(TEXT_SIZES, loadUi(KEYS.textSize)),
    spacing: pick(SPACINGS, loadUi(KEYS.spacing)),
  };
}

/** Put the choices on <html> (where app.css reads them) and save them. */
export function applyReading(reading: Reading, save: boolean): void {
  const root = document.documentElement;
  root.dataset.font = reading.font;
  root.dataset.textSize = reading.textSize;
  root.dataset.spacing = reading.spacing;
  if (!save) return;
  saveUi(KEYS.font, reading.font);
  saveUi(KEYS.textSize, reading.textSize);
  saveUi(KEYS.spacing, reading.spacing);
}
