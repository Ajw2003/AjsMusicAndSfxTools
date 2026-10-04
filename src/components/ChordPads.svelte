<script lang="ts">
  import type { ChordPad } from "../lib/song/song";

  interface Props {
    pads: ChordPad[];
    /** Ids of pads being held right now (by pointer or key). */
    heldIds: string[];
    onPadDown: (pad: ChordPad) => void;
    onPadUp: (pad: ChordPad) => void;
    onRemove: (pad: ChordPad) => void;
  }
  let { pads, heldIds, onPadDown, onPadUp, onRemove }: Props = $props();

  /** "Digit3" -> "3". */
  function keyLabel(code: string | null): string {
    return code?.startsWith("Digit") ? code.slice(5) : "";
  }

  const sorted = $derived(
    [...pads].sort((a, b) =>
      keyLabel(a.keyCode).localeCompare(keyLabel(b.keyCode)),
    ),
  );
</script>

<section class="pads" aria-label="Chord pads">
  <ul>
    {#each sorted as pad (pad.id)}
      {@const key = keyLabel(pad.keyCode)}
      <li>
        <button
          type="button"
          class="pad"
          class:held={heldIds.includes(pad.id)}
          aria-label="Play {pad.name}{key ? `, key ${key}` : ''}"
          aria-keyshortcuts={key || undefined}
          onpointerdown={(e) => {
            if (e.button !== 0) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onPadDown(pad);
          }}
          onpointerup={() => onPadUp(pad)}
          onpointercancel={() => onPadUp(pad)}
          onkeydown={(e) => {
            // Enter/Space on a focused pad plays it, like a key press.
            if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
              e.preventDefault();
              onPadDown(pad);
            }
          }}
          onkeyup={(e) => {
            if (e.key === "Enter" || e.key === " ") onPadUp(pad);
          }}
          onblur={() => onPadUp(pad)}
        >
          {#if key}<span class="key" aria-hidden="true">{key}</span>{/if}
          <span class="name" aria-hidden="true">{pad.name}</span>
        </button>
        <button
          type="button"
          class="remove"
          aria-label="Remove pad {pad.name}"
          onclick={() => onRemove(pad)}>×</button
        >
      </li>
    {/each}
  </ul>
</section>

<style>
  /* One row that scrolls sideways, so pads never push the keyboard down. */
  ul {
    list-style: none;
    margin: 0;
    padding: 0 0 0.25rem;
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
  }
  li {
    flex: 0 0 auto;
    display: flex;
    align-items: stretch;
  }
  button {
    font: inherit;
    box-sizing: border-box;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    cursor: pointer;
  }
  .pad {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 5rem;
    min-height: 2.75rem;
    padding: 0.25rem 0.75rem;
    border-radius: 0.5rem 0 0 0.5rem;
    touch-action: none;
    user-select: none;
  }
  .pad.held {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 2px var(--color-accent);
  }
  .key {
    min-width: 1.4rem;
    padding: 0 0.3rem;
    border: 1px solid var(--color-border);
    border-radius: 0.3rem;
    font-size: 0.85rem;
    color: var(--color-muted);
    text-align: center;
  }
  .name {
    font-weight: 600;
  }
  .remove {
    min-width: 2.75rem;
    border-left: none;
    border-radius: 0 0.5rem 0.5rem 0;
    color: var(--color-muted);
  }
</style>
