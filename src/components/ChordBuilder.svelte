<script lang="ts">
  import {
    CHORD_QUALITIES,
    COMMON_PROGRESSIONS,
    PITCH_NAMES,
    SCALES,
    chordName,
    diatonicChords,
    progressionBeats,
    type ChordQuality,
    type PitchClass,
    type ProgressionChord,
    type ScaleId,
  } from "../lib/song/chords";

  interface Props {
    /** Name of the track the clip will go on, or null if it can't hold notes. */
    trackName: string | null;
    beatsPerBar: number;
    /** False once every pad key (1–8) is taken. */
    canAddPad: boolean;
    onPreview: (chords: ProgressionChord[]) => void;
    onMakeClip: (chords: ProgressionChord[]) => void;
    onSavePad: (chord: ProgressionChord) => void;
  }
  let {
    trackName,
    beatsPerBar,
    canAddPad,
    onPreview,
    onMakeClip,
    onSavePad,
  }: Props = $props();

  const LENGTHS = [1, 2, 4, 8];
  let key = $state<PitchClass>(0);
  let scale = $state<ScaleId>("major");
  let chordBeats = $state(4);
  let customRoot = $state<PitchClass>(0);
  let customQuality = $state<ChordQuality>("major");
  let progression = $state<ProgressionChord[]>([]);

  const suggested = $derived(diatonicChords(key, scale));
  const totalBeats = $derived(progressionBeats(progression));

  function add(root: PitchClass, quality: ChordQuality): void {
    progression.push({ root, quality, beats: chordBeats });
  }

  function useCommon(id: string): void {
    const common = COMMON_PROGRESSIONS.find((p) => p.id === id);
    if (!common) return;
    progression = common.degrees.map((d) => ({
      root: suggested[d].root,
      quality: suggested[d].quality,
      beats: chordBeats,
    }));
  }

  function move(i: number, by: -1 | 1): void {
    const j = i + by;
    if (j < 0 || j >= progression.length) return;
    [progression[i], progression[j]] = [progression[j], progression[i]];
  }

  function lengthLabel(beats: number): string {
    if (beats % beatsPerBar === 0) {
      const bars = beats / beatsPerBar;
      return `${bars} ${bars === 1 ? "bar" : "bars"}`;
    }
    return `${beats} ${beats === 1 ? "beat" : "beats"}`;
  }

  // Selects hand focus back so computer keys play notes again at once.
  function blur(e: Event & { currentTarget: HTMLSelectElement }): void {
    e.currentTarget.blur();
  }
</script>

<section class="builder" aria-label="Chord builder">
  <div class="row">
    <label>
      Key
      <select
        value={key}
        onchange={(e) => {
          key = Number(e.currentTarget.value);
          blur(e);
        }}
      >
        {#each PITCH_NAMES as name, pc (name)}
          <option value={pc}>{name}</option>
        {/each}
      </select>
    </label>
    <label>
      Scale
      <select
        value={scale}
        onchange={(e) => {
          scale = e.currentTarget.value as ScaleId;
          blur(e);
        }}
      >
        {#each SCALES as s (s.id)}
          <option value={s.id}>{s.name}</option>
        {/each}
      </select>
    </label>
    <label>
      Each new chord lasts
      <select
        value={chordBeats}
        onchange={(e) => {
          chordBeats = Number(e.currentTarget.value);
          blur(e);
        }}
      >
        {#each LENGTHS as b (b)}
          <option value={b}>{lengthLabel(b)}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="group" role="group" aria-labelledby="suggested-heading">
    <h3 id="suggested-heading">Chords in this key (tap to add)</h3>
    <div class="row">
      {#each suggested as c (c.degree)}
        <button
          type="button"
          class="chord"
          aria-label="Add {c.name}, chord {c.numeral}"
          onclick={() => add(c.root, c.quality)}
        >
          <span class="numeral" aria-hidden="true">{c.numeral}</span>
          <span aria-hidden="true">{c.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="row">
    <label>
      Start from
      <select
        value=""
        onchange={(e) => {
          useCommon(e.currentTarget.value);
          e.currentTarget.value = "";
          blur(e);
        }}
      >
        <option value="" disabled>a common progression…</option>
        {#each COMMON_PROGRESSIONS as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>
    <span class="custom" role="group" aria-label="Any chord">
      <label>
        Any chord
        <select
          value={customRoot}
          aria-label="Root note"
          onchange={(e) => {
            customRoot = Number(e.currentTarget.value);
            blur(e);
          }}
        >
          {#each PITCH_NAMES as name, pc (name)}
            <option value={pc}>{name}</option>
          {/each}
        </select>
      </label>
      <select
        value={customQuality}
        aria-label="Chord type"
        onchange={(e) => {
          customQuality = e.currentTarget.value as ChordQuality;
          blur(e);
        }}
      >
        {#each CHORD_QUALITIES as q (q.id)}
          <option value={q.id}>{q.name}</option>
        {/each}
      </select>
      <button type="button" onclick={() => add(customRoot, customQuality)}>
        Add {chordName(customRoot, customQuality)}
      </button>
    </span>
  </div>

  <div class="group" role="group" aria-labelledby="progression-heading">
    <h3 id="progression-heading">
      Your progression{progression.length > 0
        ? ` (${lengthLabel(totalBeats)})`
        : ""}
    </h3>
    {#if progression.length === 0}
      <p class="hint">Tap chords above to add them here.</p>
    {:else}
      <ol class="progression">
        {#each progression as chord, i (i)}
          {@const name = chordName(chord.root, chord.quality)}
          <li>
            <span class="name">{name}</span>
            <select
              value={chord.beats}
              aria-label="Length of chord {i + 1}, {name}"
              onchange={(e) => {
                chord.beats = Number(e.currentTarget.value);
                blur(e);
              }}
            >
              {#each LENGTHS as b (b)}
                <option value={b}>{lengthLabel(b)}</option>
              {/each}
            </select>
            <button
              type="button"
              aria-label="Hear {name}"
              onclick={() => onPreview([chord])}>Hear</button
            >
            <button
              type="button"
              aria-label="Move {name} earlier"
              disabled={i === 0}
              onclick={() => move(i, -1)}>←</button
            >
            <button
              type="button"
              aria-label="Move {name} later"
              disabled={i === progression.length - 1}
              onclick={() => move(i, 1)}>→</button
            >
            <button
              type="button"
              aria-label="Save {name} as a chord pad"
              disabled={!canAddPad}
              onclick={() => onSavePad(chord)}>Save as pad</button
            >
            <button
              type="button"
              aria-label="Remove {name}"
              onclick={() => progression.splice(i, 1)}>Remove</button
            >
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <div class="row">
    <button
      type="button"
      disabled={progression.length === 0}
      onclick={() => onPreview(progression)}>Hear it all</button
    >
    <button
      type="button"
      class="primary"
      disabled={progression.length === 0 || trackName === null}
      onclick={() => onMakeClip(progression)}
    >
      Make clip at playhead{trackName ? ` on ${trackName}` : ""}
    </button>
    <button
      type="button"
      disabled={progression.length === 0}
      onclick={() => (progression = [])}>Clear progression</button
    >
  </div>
  {#if !canAddPad}
    <p class="hint">All 8 chord pads are in use. Remove one to save another.</p>
  {/if}
</section>

<style>
  .builder {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  .row,
  .custom {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  button,
  select {
    font: inherit;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.25rem 0.75rem;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  button {
    cursor: pointer;
    min-width: 2.75rem;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .primary {
    border-color: var(--color-accent);
    font-weight: 600;
  }
  .chord {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.5rem;
    line-height: 1.2;
  }
  .numeral {
    font-size: 0.875rem;
    color: var(--color-muted);
  }
  .progression {
    margin: 0;
    padding-left: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .progression li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .name {
    min-width: 3.5rem;
    font-weight: 600;
  }
  .hint {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.9rem;
  }
</style>
