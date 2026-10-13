/**
 * When a finger on the on-screen keyboard plays, keeps, changes or lets go
 * of a note (#110). Pure, so each rule has a test.
 */

/** A finger must travel this far (CSS px) before it slides onto another key. */
export const SLIDE_PX = 10;
/** A held note lets go once the finger is this far (CSS px) outside the row. */
export const LEAVE_PX = 24;

/** Where a finger took its current key, and which note it holds (null: none). */
export interface FingerHold {
  midi: number | null;
  x: number;
  y: number;
}

/**
 * The note a moving finger should hold next.
 * - Outside the row by more than LEAVE_PX: let go (the finger is still
 *   followed, so coming back plays again).
 * - Holding nothing (it left and came back): play the key under it.
 * - Over a gap or key edge (no key under it): keep the note.
 * - Under SLIDE_PX from where it took its key: keep the note, so a resting
 *   finger that rolls or jitters never hits the neighbouring key.
 * - Otherwise: the key under it.
 */
export function nextMidi(
  hold: FingerHold,
  x: number,
  y: number,
  keyUnder: number | null,
  isNearRow: boolean,
): number | null {
  if (!isNearRow) return null;
  if (hold.midi === null) return keyUnder;
  if (keyUnder === null || keyUnder === hold.midi) return hold.midi;
  const travelled = Math.hypot(x - hold.x, y - hold.y);
  return travelled < SLIDE_PX ? hold.midi : keyUnder;
}

/** True when (x, y) is inside the rect grown by LEAVE_PX on every side. */
export function isNearRect(
  rect: DOMRectReadOnly,
  x: number,
  y: number,
): boolean {
  return (
    x >= rect.left - LEAVE_PX &&
    x <= rect.right + LEAVE_PX &&
    y >= rect.top - LEAVE_PX &&
    y <= rect.bottom + LEAVE_PX
  );
}
