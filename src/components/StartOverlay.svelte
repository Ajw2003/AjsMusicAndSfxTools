<script lang="ts">
  import { engine } from "../lib/audio/engine";

  interface Props {
    onStarted: () => void;
  }
  let { onStarted }: Props = $props();

  let isHidden = $state(false);
  let errorMessage = $state("");

  async function begin(): Promise<void> {
    errorMessage = "";
    try {
      await engine.start();
      isHidden = true;
      onStarted();
    } catch (err) {
      errorMessage = `Could not start audio: ${err instanceof Error ? err.message : String(err)}. Tap the button to try again.`;
    }
  }

  const IGNORED_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta"]);

  function onWindowKeydown(e: KeyboardEvent): void {
    if (isHidden || e.repeat || IGNORED_KEYS.has(e.key)) return;
    void begin();
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if !isHidden}
  <div class="overlay" role="dialog" aria-modal="true" aria-label="Start audio">
    <!-- svelte-ignore a11y_autofocus -->
    <button type="button" class="start" onclick={begin} autofocus>
      Tap or press any key to start
    </button>
    {#if errorMessage}
      <p class="error" role="alert">{errorMessage}</p>
    {/if}
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--color-bg);
  }
  .start {
    font: inherit;
    font-size: 1.4rem;
    padding: 1rem 1.75rem;
    min-height: 3.5rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: 0.75rem;
    cursor: pointer;
  }
  .start:hover {
    border-color: var(--color-accent);
  }
  .error {
    max-width: 30rem;
    text-align: center;
    color: var(--color-error);
  }
</style>
