import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {ignores: ["**/.next/**", "**/coverage/**", "**/dist/**", "**/postcss.config.mjs"]},
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}
    }
  }
);
