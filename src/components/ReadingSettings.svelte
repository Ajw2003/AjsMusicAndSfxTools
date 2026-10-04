<script lang="ts">
  import {
    FONTS,
    SPACINGS,
    TEXT_SIZES,
    applyReading,
    loadReading,
    type Reading,
  } from "../lib/reading";

  let reading = $state<Reading>(loadReading());

  function choose(): void {
    applyReading(reading, true);
  }
</script>

<section class="panel reading" aria-label="Reading settings">
  <fieldset>
    <legend>Font</legend>
    {#each FONTS as f (f.id)}
      <label>
        <input
          type="radio"
          name="reading-font"
          value={f.id}
          bind:group={reading.font}
          onchange={choose}
        />
        {f.label}
      </label>
    {/each}
  </fieldset>
  <fieldset>
    <legend>Text size</legend>
    {#each TEXT_SIZES as t (t.id)}
      <label>
        <input
          type="radio"
          name="reading-size"
          value={t.id}
          bind:group={reading.textSize}
          onchange={choose}
        />
        {t.label}
      </label>
    {/each}
  </fieldset>
  <fieldset>
    <legend>Spacing</legend>
    {#each SPACINGS as s (s.id)}
      <label>
        <input
          type="radio"
          name="reading-spacing"
          value={s.id}
          bind:group={reading.spacing}
          onchange={choose}
        />
        {s.label}
      </label>
    {/each}
  </fieldset>
</section>

<style>
  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0;
    padding: 0.25rem 0.75rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    min-width: 0;
  }
  legend {
    padding: 0 0.25rem;
  }
  label {
    min-height: 2.75rem;
  }
  input[type="radio"] {
    width: 1.5rem;
    height: 1.5rem;
    min-height: 0;
    accent-color: var(--color-accent);
  }
</style>
