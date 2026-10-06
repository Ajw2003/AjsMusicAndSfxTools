/// <reference types="vitest/config" />
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const version: string = (
  JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
).version;

function shortCommit(): string {
  const fromCi = process.env.GITHUB_SHA?.slice(0, 7);
  if (fromCi) return fromCi;
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(shortCommit()),
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
