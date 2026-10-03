/** "12 notes" / "1 note" / "No notes". */
export function noteSummary(count: number): string {
  if (count === 0) return "No notes";
  return count === 1 ? "1 note" : `${count} notes`;
}

/** "Bar 2 · Beat 3" for a loop position in beats. */
export function positionLabel(beat: number, beatsPerBar: number): string {
  const b = Math.max(0, beat);
  const bar = Math.floor(b / beatsPerBar) + 1;
  const inBar = Math.floor(b % beatsPerBar) + 1;
  return `Bar ${bar} · Beat ${inBar}`;
}
