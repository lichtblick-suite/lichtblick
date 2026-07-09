// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fixupPluginRules } from "@eslint/compat";
import fileProgressPlugin from "eslint-plugin-file-progress";
import storybookPlugin from "eslint-plugin-storybook";
import tssUnusedClassesPlugin from "eslint-plugin-tss-unused-classes";
import globals from "globals";

import lichtblickPlugin from "@lichtblick/eslint-plugin";
import suitePlugin from "@lichtblick/eslint-plugin-suite";

const storyFiles = [
  "**/*.stories.ts",
  "**/*.stories.tsx",
  "**/*.stories.js",
  "**/*.stories.jsx",
  "**/*.stories.mjs",
  "**/*.stories.cjs",
  "**/*.story.ts",
  "**/*.story.tsx",
  "**/*.story.js",
  "**/*.story.jsx",
  "**/*.story.mjs",
  "**/*.story.cjs",
];

const fixedStorybook = fixupPluginRules(storybookPlugin);

export default [
  // Global ignores (replaces ignorePatterns)
  {
    ignores: [
      "**/.webpack/**",
      "**/.yarn/**",
      "**/.storybook/**",
      "**/dist/**",
      "**/out/**",
      "**/template/**",
      "packages/**/wasm/*.js",
      "storybook-static/**",
      "**/coverage/**",
    ],
  },

  // @lichtblick shared configs — flat-config-native arrays
  ...lichtblickPlugin.configs.base,
  // Scope TypeScript type-checked rules to .ts/.tsx files only
  ...lichtblickPlugin.configs.typescript.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  // The plugin sets `projectService: true` which auto-discovers all tsconfig.json files,
  // creating a separate TypeScript Language Service per package — causing OOM in monorepos.
  // Override with a single consolidated tsconfig (same behaviour as the pre-v9 migration).
  // See tsconfig.eslint.json for fuller explanation.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // TypeScript-specific rule overrides — ported from .eslintrc.yaml `overrides` section.
  // These rules were explicitly configured before the ESLint v9 migration; omitting them
  // would enable strict rules that the codebase was never intended to comply with.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description" },
      ],
      "@typescript-eslint/explicit-member-accessibility": "error",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unnecessary-type-parameters": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",

      // These are related to `any` types, which we generally don't have except from imports.
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",

      // Often used with e.g. useCallback(async () => {})
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/restrict-template-expressions": "off",

      "@typescript-eslint/prefer-regexp-exec": "off",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/unbound-method": ["error", { ignoreStatic: true }],

      "no-loop-func": "error",

      // Unused vars must have `_` prefix, but `_` alone is not ignored.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          varsIgnorePattern: "^_.",
          argsIgnorePattern: "^_.",
        },
      ],

      // TypeScript already validates named imports at compile time via its type system.
      // The import/named rule is redundant for TypeScript files and generates false
      // positives for packages with non-standard export patterns (e.g. webpack's
      // `export = exports`, or packages without a `types` field).
      "import/named": "off",
    },
  },
  ...lichtblickPlugin.configs.react,
  // Jest config scoped to test/spec files
  ...lichtblickPlugin.configs.jest.map((config) => ({
    ...config,
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test.js",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.spec.js",
    ],
    rules: {
      ...config.rules,
      // Custom assertFunctionNames so that tests using sendNotification assertions don't fail.
      "jest/expect-expect": [
        "error",
        { assertFunctionNames: ["expect*", "sendNotification.expectCalledDuringTest"] },
      ],
    },
  })),

  // Project-wide config
  {
    plugins: {
      "@lichtblick/suite": suitePlugin,
      "file-progress": fixupPluginRules(fileProgressPlugin),
      "tss-unused-classes": fixupPluginRules(tssUnusedClassesPlugin),
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2015,
      },
    },
    settings: {
      "import/internal-regex": "^@lichtblick",
      // Use TypeScript parser to resolve named exports from .ts/.tsx/.d.ts files.
      // eslint-import-resolver-typescript uses TypeScript's module resolution, which
      // correctly handles type-only exports and TypeScript path aliases.
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx", ".d.ts"],
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.eslint.json",
        },
      },
      // Packages that use non-standard export patterns (e.g. `export = exports`) or lack
      // proper type declaration roots that the resolver can statically analyse.
      // TypeScript already validates named imports for these packages at compile time.
      // (kept as a placeholder for non-TypeScript files that may still need it)
    },
    rules: {
      "@lichtblick/license-header": ["error", { licenseType: "MPL-2.0" }],
      "@lichtblick/prefer-hash-private": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",

      "tss-unused-classes/unused-classes": "error",

      // show progress while linting; disabled in CI via eslint.config.ci.mjs
      "file-progress/activate": "warn",

      // Formatting is handled by Biome (see biome.json), not ESLint. The prettier/prettier
      // rule is registered by the shared @lichtblick/eslint-plugin base config, so it is
      // explicitly disabled here and in eslint.config.ci.mjs.
      "prettier/prettier": "off",
      "import/no-self-import": "off",
      "import/no-duplicates": "off",

      "id-denylist": ["error", "useEffectOnce", "window"],
      "no-console": "off", // configured in no-restricted-syntax

      "react/jsx-uses-react": "off",
      "react/prop-types": "off", // Unnecessary with typescript validation
      "react-hooks/exhaustive-deps": [
        "error",
        {
          additionalHooks: "(useAsync(?!AppConfigurationValue))|useCallbackWithToast",
        },
      ],
      "react/jsx-curly-brace-presence": ["error", "never"],

      // The _sx_ property is slow
      // https://stackoverflow.com/questions/68383046/is-there-a-performance-difference-between-the-sx-prop-and-the-makestyles-function
      "react/forbid-component-props": [
        "error",
        {
          forbid: [
            {
              propName: "sx",
              message:
                "Use of the sx prop is not advised due to performance issues. Consider using alternative styling methods instead.",
            },
          ],
        },
      ],

      "no-warning-comments": ["error", { terms: ["fixme", "xxx", "todo"], location: "anywhere" }],

      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@emotion/styled",
              importNames: ["styled"],
              message: "@emotion/styled has performance implications. Use tss-react/mui instead.",
            },
            {
              name: "@mui/material",
              importNames: ["styled"],
              message: "@mui/styled has performance implications. Use tss-react/mui instead.",
            },
            {
              name: "@mui/system",
              importNames: ["styled"],
              message: "@mui/styled has performance implications. Use tss-react/mui instead.",
            },
            {
              name: "@mui/material/styles/styled",
              message: "@mui/styled has performance implications. Use tss-react/mui instead.",
            },
            {
              name: "@mui/material",
              importNames: ["Box"],
              message: "@mui/Box has performance implications. Use tss-react/mui instead.",
            },
            {
              name: "@mui/system",
              importNames: ["Box"],
              message: "@mui/Box has performance implications. Use tss-react/mui instead.",
            },
          ],
        },
      ],

      "no-restricted-syntax": [
        "error",
        {
          selector: "MethodDefinition[kind='get'], Property[kind='get']",
          message: "Property getters are not allowed; prefer function syntax instead.",
        },
        {
          selector: "MethodDefinition[kind='set'], Property[kind='set']",
          message: "Property setters are not allowed; prefer function syntax instead.",
        },
      ],

      // @lichtblick/suite plugin rules
      "@lichtblick/suite/link-target": "error",
      "@lichtblick/suite/lodash-ramda-imports": "error",
      "@lichtblick/suite/ramda-usage": "error",
      "@lichtblick/suite/no-map-type-argument": "error",
    },
  },

  // `any` is acceptable in test and story files where strict typing is impractical.
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test.js",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.spec.js",
      ...storyFiles,
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Story files: sx prop is sometimes used intentionally in stories.
  {
    files: storyFiles,
    rules: {
      "react/forbid-component-props": "off",
    },
  },

  // Builder pattern files use static-only classes intentionally.
  {
    files: ["packages/suite-base/src/testing/**"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },

  // Style files: tss classes are consumed indirectly, not always referenced directly.
  {
    files: ["**/*.style.ts"],
    rules: {
      "tss-unused-classes/unused-classes": "off",
    },
  },

  // Storybook rules — scoped to story files
  {
    files: storyFiles,
    plugins: {
      storybook: fixedStorybook,
    },
    rules: {
      "import/no-anonymous-default-export": "off",
      "storybook/await-interactions": "error",
      "storybook/context-in-play-function": "error",
      "storybook/default-exports": "error",
      "storybook/hierarchy-separator": "warn",
      "storybook/no-redundant-story-name": "warn",
      "storybook/prefer-pascal-case": "warn",
      "storybook/story-exports": "error",
      "storybook/use-storybook-expect": "error",
      "storybook/use-storybook-testing-library": "error",
    },
  },
  // Storybook rules — scoped to .storybook main config files
  {
    files: [
      ".storybook/main.js",
      ".storybook/main.cjs",
      ".storybook/main.mjs",
      ".storybook/main.ts",
    ],
    plugins: {
      storybook: fixedStorybook,
    },
    rules: {
      "storybook/no-uninstalled-addons": "error",
    },
  },

  // packages/suite-desktop/src/main: disable unresolvable import rules
  // Re-enable when https://github.com/benmosher/eslint-plugin-import/issues/1996 is fixed
  {
    files: ["packages/suite-desktop/src/main/**"],
    rules: {
      "import/no-unresolved": "off",
      "import/namespace": "off",
      "import/default": "off",
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
    },
  },

  // userUtils: no license header required
  {
    files: [
      "packages/suite-base/src/players/UserScriptPlayer/transformerWorker/typescript/userUtils/**",
    ],
    rules: {
      "@lichtblick/license-header": "off",
    },
  },
];
