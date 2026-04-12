/**
 * ESLint flat config. Uses `typescript-eslint` `recommended` (not
 * `recommendedTypeChecked`): type-aware rules need `parserOptions.project` and
 * slow lint runs; `npm run check:types` covers types instead.
 */
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "tmp/**"] },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: "module",
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["test/**/*.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  eslintConfigPrettier,
);
