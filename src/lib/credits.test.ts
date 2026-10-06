import realCredits from "../../CREDITS.md?raw";
import { describe, expect, it } from "vitest";
import { parseCredits } from "./credits";

const sample = `# Credits

Top line one
with \`code\`.

| Asset | Author |
| ----- | ------ |
| (none yet) |  |

## Fonts

Bundled.

| Font | Author |
| --- | --- |
| Lexend | Someone |
| Other | Another |
`;

describe("parseCredits", () => {
  it("reads sections, intros and tables, skipping placeholders", () => {
    const s = parseCredits(sample);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({
      heading: "",
      intro: "Top line one with code.",
      columns: ["Asset", "Author"],
      rows: [],
    });
    expect(s[1].heading).toBe("Fonts");
    expect(s[1].intro).toBe("Bundled.");
    expect(s[1].columns).toEqual(["Font", "Author"]);
    expect(s[1].rows).toEqual([
      ["Lexend", "Someone"],
      ["Other", "Another"],
    ]);
  });

  it("lists every font in the real CREDITS.md", () => {
    const fonts = parseCredits(realCredits).find((s) => s.heading === "Fonts");
    const names = fonts?.rows.map((r) => r[0]);
    for (const n of ["Atkinson Hyperlegible", "Lexend", "OpenDyslexic"]) {
      expect(names).toContain(n);
    }
  });
});
