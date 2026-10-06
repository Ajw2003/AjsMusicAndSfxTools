import js from "@eslint/js";
import globals from "globals";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "docs", ".claude"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        // Filled in at build time by vite.config.ts.
        __APP_VERSION__: "readonly",
        __APP_COMMIT__: "readonly",
      },
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Browser checks run under Node with a Playwright install on NODE_PATH.
    files: ["e2e/**/*.cjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.commonjs, ...globals.browser },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
