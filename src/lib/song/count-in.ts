/**
 * The number to show during a count-in: `beats` on the first click, down to 1
 * on the last. Null once the count-in is over. Driven by the audio clock
 * (`now`, `startTime`, seconds), so it matches the clicks that are heard.
 */
export function countInNumber(
  now: number,
  startTime: number,
  secondsPerBeat: number,
  beats: number,
): number | null {
  if (secondsPerBeat <= 0 || now >= startTime + beats * secondsPerBeat) {
    return null;
  }
  const clicksHeard = Math.max(
    0,
    Math.floor((now - startTime) / secondsPerBeat),
  );
  return beats - clicksHeard;
}
