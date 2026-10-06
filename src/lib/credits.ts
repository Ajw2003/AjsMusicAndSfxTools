/** Reads CREDITS.md (headings, paragraphs, pipe tables) so the About screen can't drift from it. */

export interface CreditSection {
  heading: string;
  intro: string;
  columns: string[];
  rows: string[][];
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function parseCredits(markdown: string): CreditSection[] {
  const sections: CreditSection[] = [];
  let current: CreditSection = {
    heading: "",
    intro: "",
    columns: [],
    rows: [],
  };
  let paragraph: string[] = [];
  let sawHeader = false;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      const text = paragraph.join(" ").replace(/`/g, "");
      current.intro = current.intro ? `${current.intro} ${text}` : text;
      paragraph = [];
    }
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flushParagraph();
      sections.push(current);
      current = {
        heading: line.slice(3).trim(),
        intro: "",
        columns: [],
        rows: [],
      };
      sawHeader = false;
    } else if (line.startsWith("# ")) {
      continue;
    } else if (line.startsWith("|")) {
      flushParagraph();
      const row = cells(line);
      if (row.every((c) => /^:?-+:?$/.test(c))) continue;
      if (!sawHeader) {
        current.columns = row;
        sawHeader = true;
      } else if (row[0] !== "(none yet)") {
        current.rows.push(row);
      }
    } else if (line === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  sections.push(current);
  return sections;
}
