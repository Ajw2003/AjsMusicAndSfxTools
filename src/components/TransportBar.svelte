<script lang="ts">
  import { positionLabel } from "../lib/song/loop-view";

  interface Props {
    beat: number;
    isPlaying: boolean;
    isCountingIn: boolean;
    isRecording: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onPlayPause: () => void;
    onBackToStart: () => void;
    onRecordToggle: () => void;
    onUndo: () => void;
    onRedo: () => void;
  }
  let {
    beat,
    isPlaying,
    isCountingIn,
    isRecording,
    canUndo,
    canRedo,
    onPlayPause,
    onBackToStart,
    onRecordToggle,
    onUndo,
    onRedo,
  }: Props = $props();

  const busy = $derived(isPlaying || isCountingIn);
</script>

<section class="transport" aria-label="Transport">
  <div class="row">
    <button type="button" class="primary" onclick={onPlayPause}>
      {busy ? "Pause" : "Play"}
    </button>
    <button type="button" onclick={onBackToStart}>Back to start</button>
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
  button {
    font: inherit;
    font-size: 1.1rem;
    min-height: 3.25rem;
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
  .position {
    min-width: 8rem;
    font-size: 1.1rem;
    font-variant-numeric: tabular-nums;
    color: var(--color-muted);
  }
  @media (max-width: 600px) {
    .row {
      gap: 0.4rem 0.5rem;
    }
    button {
      padding: 0.25rem 0.6rem;
    }
    .position {
      min-width: 0;
      flex: 1 1 auto;
    }
  }
</style>
