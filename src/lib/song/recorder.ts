import {
  MIN_NOTE_BEATS,
  quantizeBeat,
  wrapNoteToLoop,
  type Note,
} from "./song";

interface Finished {
  midi: number;
  velocity: number;
  start: number;
  end: number;
}

/**
 * Collects played notes while the loop runs. Times are loop positions in
 * beats. Pure: the caller supplies the beat for every event.
 */
export class TakeRecorder {
  /** Snap grid for note starts in beats; 0 means off. */
  quantizeGrid = 0;
  #held = new Map<number, { velocity: number; start: number }>();
  #finished: Finished[] = [];

  /** Number of notes currently held down. */
  get heldCount(): number {
    return this.#held.size;
  }

  noteOn(midi: number, velocity: number, beat: number): void {
    // A repeated on without an off restarts the note.
    this.#held.set(midi, { velocity, start: beat });
  }

  noteOff(midi: number, beat: number): void {
    const h = this.#held.get(midi);
    if (!h) return;
    this.#held.delete(midi);
    this.#finished.push({
      midi,
      velocity: h.velocity,
      start: h.start,
      end: beat,
    });
  }

  /**
   * Finished notes so far (cleared); still-held notes stay pending. With a
   * loop length, times wrap into the loop; without one (Infinity, the
   * default) they are left as played, for a straight-line recording.
   */
  collect(loopLength = Infinity): Note[] {
    const out = this.#finished.map((f) => {
      if (!Number.isFinite(loopLength)) {
        return {
          id: crypto.randomUUID(),
          pitch: f.midi,
          startBeat: quantizeBeat(f.start, this.quantizeGrid),
          durationBeats: Math.max(MIN_NOTE_BEATS, f.end - f.start),
          velocity: f.velocity,
        };
      }
      // An off earlier in the loop than the on means the loop wrapped.
      const raw =
        f.end >= f.start ? f.end - f.start : f.end - f.start + loopLength;
      return wrapNoteToLoop(
        {
          id: crypto.randomUUID(),
          pitch: f.midi,
          startBeat: quantizeBeat(f.start, this.quantizeGrid),
          durationBeats: raw,
          velocity: f.velocity,
        },
        loopLength,
      );
    });
    this.#finished = [];
    return out;
  }

  /** Close every held note at `beat`, then collect everything. */
  flushAll(beat: number, loopLength = Infinity): Note[] {
    for (const midi of [...this.#held.keys()]) this.noteOff(midi, beat);
    return this.collect(loopLength);
  }
}
