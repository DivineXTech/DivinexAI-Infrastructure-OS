// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Shared base ESLint flat config for DivinexAI packages and apps. */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", ".turbo/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);

export default baseConfig;
