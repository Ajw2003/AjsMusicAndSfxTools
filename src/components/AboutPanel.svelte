<script lang="ts">
  import credits from "../../CREDITS.md?raw";
  import { parseCredits } from "../lib/credits";

  const sections = parseCredits(credits);
  const isLink = (cell: string): boolean => cell.startsWith("http");
</script>

<section class="panel about" aria-label="About">
  <h2>AJ's Music &amp; SFX Tools</h2>
  <p>Version {__APP_VERSION__} (build {__APP_COMMIT__})</p>
  <p>
    Free and open source under the MIT licence.
    <a href="https://github.com/Ajw2003/AjsMusicAndSfxTools"
      >Source code on GitHub</a
    >
  </p>
  {#each sections as s (s.heading)}
    {@const title = s.heading || "Credits"}
    <h3>{title}</h3>
    {#if s.intro}<p>{s.intro}</p>{/if}
    {#if s.columns.length > 0 && s.rows.length > 0}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="scroll"
        role="region"
        aria-label="{title} credits table"
        tabindex="0"
      >
        <table>
          <thead>
            <tr>
              {#each s.columns as c (c)}<th scope="col">{c}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each s.rows as row, i (i)}
              <tr>
                {#each row as cell, j (j)}
                  <td>
                    {#if isLink(cell)}<a href={cell}>{cell}</a
                      >{:else}{cell}{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/each}
</section>

<style>
  .about {
    display: block;
  }
  h2,
  h3,
  p {
    margin: 0.5rem 0;
  }
  .scroll {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    vertical-align: top;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--color-border);
  }
  td a {
    overflow-wrap: anywhere;
  }
</style>
