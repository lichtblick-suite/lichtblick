// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// We keep some slow lint rules here, and only run them in CI.
// Please only add rules here if they are unlikely to be encountered
// during normal development.

import baseConfig from "./eslint.config.mjs";

export default [
  ...baseConfig,

  // CI-only rule overrides
  {
    rules: {
      // disable progress spinner in CI output
      "file-progress/activate": "off",
      // Formatting is enforced by Biome (see biome.json + `yarn format:ci`), not ESLint.
      // The rule is provided by the shared @lichtblick/eslint-plugin base config and is
      // kept disabled here so ESLint no longer double-checks formatting.
      "prettier/prettier": "off",
      // Common sense should prevent triggering this in development
      "import/no-self-import": "error",
      // https://github.com/import-js/eslint-plugin-import/issues/242#issuecomment-230118951
      "import/no-duplicates": "error",
      // https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md
      "import/no-cycle": ["error", { ignoreExternal: true }],
    },
  },

  // suite-base has ~134 pre-existing cyclic imports present before the ESLint 9 migration.
  // They are excluded here to keep CI green. New code should not introduce new cycles, and existing cycles should be resolved over time.
  {
    files: ["packages/suite-base/**"],
    rules: {
      "import/no-cycle": "off",
    },
  },

  // Relaxed rules for e2e CI helpers
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
