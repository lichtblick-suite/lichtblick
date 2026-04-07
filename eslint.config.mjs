// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";

import lichtblickPlugin from "@lichtblick/eslint-plugin";
import suitePlugin from "@lichtblick/eslint-plugin-suite";
import fileProgressPlugin from "eslint-plugin-file-progress";
import storybookPlugin from "eslint-plugin-storybook";
import tssUnusedClassesPlugin from "eslint-plugin-tss-unused-classes";

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
    },
    rules: {
      "@lichtblick/license-header": ["error", { licenseType: "MPL-2.0" }],
      "@lichtblick/prefer-hash-private": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",

      "tss-unused-classes/unused-classes": "error",

      // show progress while linting; disabled in CI via eslint.config.ci.mjs
      "file-progress/activate": "warn",

      // enabled in eslint.config.ci.mjs
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

  // packages/suite-base: add webpack import resolver for `?raw` imports
  {
    files: ["packages/suite-base/**"],
    settings: {
      "import/resolver": {
        webpack: {
          config: {
            resolve: {
              extensions: [".ts", ".tsx"],
            },
          },
        },
      },
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
