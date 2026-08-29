import { baseConfig } from "@divinexai/config/eslint";

export default [
  ...baseConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
