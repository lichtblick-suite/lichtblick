// @ts-check
import baseConfig from "./eslint.config.mjs";

export default [
  ...baseConfig.map((config) => {
    // Remove parserOptions.project to disable type-aware linting (MUCH faster)
    if (config.languageOptions?.parserOptions?.project) {
      return {
        ...config,
        languageOptions: {
          ...config.languageOptions,
          parserOptions: {
            ...config.languageOptions.parserOptions,
            project: undefined,
          },
        },
      };
    }

    if (config.rules) {
      return {
        ...config,
        rules: {
          ...config.rules,
          // Disable progress spinner for CI
          "file-progress/activate": "off",
          // VScode is already configured to run prettier on save
          "prettier/prettier": "error",
          // Common sense should prevent triggering this in development
          "import/no-self-import": "error",
          // https://github.com/import-js/eslint-plugin-import/issues/242#issuecomment-230118951
          "import/no-duplicates": "error",
        },
      };
    }
    return config;
  }),
  {
    // https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md
    rules: {
      "import/no-cycle": "off",
    },
  },
  {
    files: ["e2e/ci-helpers/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "import/order": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
    },
  },
];
