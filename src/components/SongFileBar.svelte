<script lang="ts">
  import { engine } from "../lib/audio/engine";
  import type { Song } from "../lib/song/song";
  import { createSong } from "../lib/song/song";
  import { parseSong, serializeSong } from "../lib/song/storage";

  interface Props {
    song: Song;
    onReplace: (song: Song) => void;
  }
  let { song, onReplace }: Props = $props();

  let range = $state<"song" | "loop">("song");
  let loops = $state(1);
  let isRendering = $state(false);
  let message = $state("");
  let isError = $state(false);
  let fileInput: HTMLInputElement;

  function download(
    data: string | Uint8Array,
    type: string,
    filename: string,
  ): void {
    const part = typeof data === "string" ? data : new Uint8Array(data);
    const url = URL.createObjectURL(new Blob([part], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function fail(text: string): void {
    isError = true;
    message = text;
  }

  async function downloadWav(): Promise<void> {
    message = "";
    isRendering = true;
    try {
      const bytes = await engine.renderWav(song, {
        range: song.loopRegion ? range : "song",
        passes: loops,
      });
      download(bytes, "audio/wav", "ajs-song.wav");
      isError = false;
      message = "Saved ajs-song.wav.";
    } catch (err) {
      fail(
        `Could not render the WAV: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      isRendering = false;
    }
  }

  function saveProject(): void {
    download(serializeSong(song), "application/json", "ajs-song.ajsong.json");
    isError = false;
    message = "Saved ajs-song.ajsong.json.";
  }

  async function openProject(
    e: Event & { currentTarget: HTMLInputElement },
  ): Promise<void> {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    try {
      onReplace(parseSong(await file.text()));
      isError = false;
      message = `Opened ${file.name}.`;
    } catch (err) {
      fail(
        `Could not open ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function newSong(): void {
    if (!confirm("Start a new song? The current song will be discarded.")) {
      return;
    }
    onReplace(createSong());
    isError = false;
    message = "Started a new song.";
  }
</script>

<section class="files" aria-label="Save and export">
  <div class="row">
    <label>
      Export
      <select bind:value={range} onchange={(e) => e.currentTarget.blur()}>
        <option value="song">Whole song</option>
        <option value="loop" disabled={!song.loopRegion}>Loop region</option>
      </select>
    </label>
    <label class:hidden={range !== "loop"}>
      Passes
      <select bind:value={loops} onchange={(e) => e.currentTarget.blur()}>
        {#each [1, 2, 4, 8] as n (n)}
          <option value={n}>{n}</option>
        {/each}
      </select>
    </label>
    <button type="button" disabled={isRendering} onclick={downloadWav}>
      {isRendering ? "Rendering…" : "Download WAV"}
    </button>
    <button type="button" onclick={saveProject}>Save project</button>
    <button type="button" onclick={() => fileInput.click()}>
      Open project
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json"
      hidden
      aria-label="Open project file"
      onchange={openProject}
    />
    <button type="button" onclick={newSong}>New song</button>
  </div>
  <p class="status" class:error={isError} role={isError ? "alert" : "status"}>
    {isRendering ? "Rendering…" : message}
  </p>
</section>

<style>
  .files {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  button,
  select {
    font: inherit;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.25rem 0.9rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .hidden {
    display: none;
  }
  .status {
    margin: 0;
    min-height: 1.25rem;
    color: var(--color-muted);
  }
  .status.error {
    color: var(--color-error);
  }
</style>
