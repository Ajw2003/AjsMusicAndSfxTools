<script lang="ts">
  import { positionLabel } from "../lib/song/loop-view";

  interface Props {
    bpm: number;
    /** "New clip length" in bars. */
    newClipBars: number;
    beat: number;
    loopOn: boolean;
    isPlaying: boolean;
    isCountingIn: boolean;
    isRecording: boolean;
    canUndo: boolean;
    canRedo: boolean;
    metronomeOn: boolean;
    quantizeGrid: number;
    onPlayPause: () => void;
    onBackToStart: () => void;
    onLoop: (isOn: boolean) => void;
    onNewClip: () => void;
    onRecordToggle: () => void;
    onBpm: (bpm: number) => void;
    onNewClipBars: (bars: number) => void;
    onMetronome: (isOn: boolean) => void;
    onQuantize: (grid: number) => void;
    onUndo: () => void;
    onRedo: () => void;
  }
  let {
    bpm,
    newClipBars,
    beat,
    loopOn,
    isPlaying,
    isCountingIn,
    isRecording,
    canUndo,
    canRedo,
    metronomeOn,
    quantizeGrid,
    onPlayPause,
    onBackToStart,
    onLoop,
    onNewClip,
    onRecordToggle,
    onBpm,
    onNewClipBars,
    onMetronome,
    onQuantize,
    onUndo,
    onRedo,
  }: Props = $props();

  const BARS = [1, 2, 4, 8];
  const QUANTIZE = [
    { value: 0, label: "Off" },
    { value: 0.25, label: "1/4 beat (1/16 note)" },
    { value: 0.5, label: "1/2 beat (1/8 note)" },
    { value: 1, label: "1 beat" },
  ];

  const busy = $derived(isPlaying || isCountingIn);

  function onBpmChange(e: Event & { currentTarget: HTMLInputElement }): void {
    const value = Number(e.currentTarget.value);
    if (Number.isFinite(value) && e.currentTarget.value !== "") {
      onBpm(value);
    }
    // Show the clamped value the song actually has.
    e.currentTarget.value = String(bpm);
  }

  // After a select changes, hand focus back so computer keys play at once.
  function blurAfter(e: Event & { currentTarget: HTMLSelectElement }): void {
    e.currentTarget.blur();
  }
</script>

<section class="transport" aria-label="Transport">
  <div class="row">
    <button type="button" class="primary" onclick={onPlayPause}>
      {busy ? "Pause" : "Play"}
    </button>
    <button type="button" onclick={onBackToStart}>Back to start</button>
    <button type="button" aria-pressed={loopOn} onclick={() => onLoop(!loopOn)}>
      Loop
    </button>
    <button
      type="button"
      class="record"
      aria-pressed={isRecording}
      onclick={onRecordToggle}
    >
      <span class="dot" aria-hidden="true"></span>
      Record
    </button>
    <span class="position" aria-label="Position">
      {isCountingIn ? "Count-in…" : positionLabel(beat, 4)}
    </span>
    <button type="button" disabled={!canUndo} onclick={onUndo}>Undo</button>
    <button type="button" disabled={!canRedo} onclick={onRedo}>Redo</button>
  </div>
  <div class="row">
    <label>
      BPM
      <input
        type="number"
        min="40"
        max="240"
        step="1"
        value={bpm}
        onchange={onBpmChange}
      />
    </label>
    <label>
      New clip length
      <select
        value={newClipBars}
        onchange={(e) => {
          onNewClipBars(Number(e.currentTarget.value));
          blurAfter(e);
        }}
      >
        {#each BARS as b (b)}
          <option value={b}>{b} {b === 1 ? "bar" : "bars"}</option>
        {/each}
      </select>
    </label>
    <button type="button" onclick={onNewClip}>New clip</button>
    <label>
      Quantize
      <select
        value={quantizeGrid}
        onchange={(e) => {
          onQuantize(Number(e.currentTarget.value));
          blurAfter(e);
        }}
      >
        {#each QUANTIZE as q (q.value)}
          <option value={q.value}>{q.label}</option>
        {/each}
      </select>
    </label>
    <button
      type="button"
      aria-pressed={metronomeOn}
      onclick={() => onMetronome(!metronomeOn)}
    >
      Metronome
    </button>
  </div>
</section>

<style>
  .transport {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  button,
  input,
  select {
    font: inherit;
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.25rem 0.9rem;
    color: var(--color-text);
    background: var(--color-surface);
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
  button[aria-pressed="true"] {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 2px var(--color-accent);
    font-weight: 600;
  }
  .record .dot {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    margin-right: 0.4rem;
    border-radius: 50%;
    background: var(--color-error);
  }
  .record[aria-pressed="true"] {
    border-color: var(--color-error);
    box-shadow: inset 0 0 0 2px var(--color-error);
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  input[type="number"] {
    width: 5rem;
  }
  .position {
    min-width: 8rem;
    font-variant-numeric: tabular-nums;
    color: var(--color-muted);
  }
  @media (max-width: 600px) {
    .row {
      gap: 0.4rem 0.5rem;
    }
    button,
    input,
    select {
      padding: 0.25rem 0.6rem;
    }
    .position {
      min-width: 0;
      flex: 1 1 auto;
    }
  }
</style>
