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
      <!-- Phones: one card per credit, so no word is squeezed and split. -->
      <ul class="cards">
        {#each s.rows as row, i (i)}
          <li>
            <dl>
              {#each row as cell, j (j)}
                <div>
                  <dt>{s.columns[j]}</dt>
                  <dd>
                    {#if isLink(cell)}<a href={cell}>{cell}</a
                      >{:else}{cell}{/if}
                  </dd>
                </div>
              {/each}
            </dl>
          </li>
        {/each}
      </ul>
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
    /* Words are never split; only long links may wrap anywhere. */
    overflow-wrap: normal;
    text-align: left;
    vertical-align: top;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--color-border);
  }
  td a,
  dd a {
    overflow-wrap: anywhere;
  }
  .cards {
    display: none;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .cards li {
    margin: 0.5rem 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
  }
  dl {
    margin: 0;
  }
  dl div {
    margin: 0.25rem 0;
  }
  dt {
    font-weight: 700;
  }
  dd {
    margin: 0;
  }
  @media (max-width: 600px) {
    .scroll {
      display: none;
    }
    .cards {
      display: block;
    }
  }
</style>
