import js from "@eslint/js";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      unicorn,
      prettier,
    },
    rules: {
      ...unicorn.configs.recommended.rules,
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
      "unicorn/prevent-abbreviations": "warn",
      "prettier/prettier": "error",
    },
  },
];
