// @ts-check
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";
import pluginFileProgress from "eslint-plugin-file-progress";
import pluginTssUnusedClasses from "eslint-plugin-tss-unused-classes";
import pluginSuite from "@lichtblick/eslint-plugin-suite";
import baseConfig from "@lichtblick/eslint-plugin/configs/base.mjs";
import reactConfig from "@lichtblick/eslint-plugin/configs/react.mjs";
import jestConfig from "@lichtblick/eslint-plugin/configs/jest.mjs";
import typescriptConfig from "@lichtblick/eslint-plugin/configs/typescript.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: [
      "dist",
      "out",
      "template",
      "packages/**/wasm/*.js",
      "storybook-static",
      "coverage",
      "!.storybook",
      "node_modules/**",
      // Ignore config files - they are slow to lint and not critical
      "**/webpack.config.ts",
      "**/webpack.*.config.ts",
      "**/vite.config.ts",
      "**/jest.config.ts",
      "**/.storybook/**",
    ],
  },
  ...baseConfig,
  ...reactConfig,
  ...jestConfig,
  ...compat.extends("plugin:storybook/recommended"),
  {
    plugins: {
      "file-progress": pluginFileProgress,
      "tss-unused-classes": pluginTssUnusedClasses,
      "@lichtblick/suite": pluginSuite,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    settings: {
      "import/internal-regex": "^@lichtblick",
    },
    rules: {
      "@lichtblick/license-header": ["error", { licenseType: "MPL-2.0" }],
      "@lichtblick/prefer-hash-private": "off",
      "@lichtblick/suite/link-target": "error",
      "@lichtblick/suite/lodash-ramda-imports": "error",
      "@lichtblick/suite/ramda-usage": "error",
      "@lichtblick/suite/no-map-type-argument": "error",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
      "tss-unused-classes/unused-classes": "error",
      "file-progress/activate": "warn",
      "prettier/prettier": "off",
      "import/no-self-import": "off",
      "import/no-duplicates": "off",
      "id-denylist": ["error", "useEffectOnce", "window"],
      "no-console": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
      "react-hooks/exhaustive-deps": [
        "error",
        { additionalHooks: "(useAsync(?!AppConfigurationValue))|useCallbackWithToast" },
      ],
      "react/jsx-curly-brace-presence": ["error", "never"],
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
      "no-warning-comments": [
        "error",
        { terms: ["fixme", "xxx", "todo"], location: "anywhere" },
      ],
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
        {
          selector:
            "CallExpression[callee.object.name='console'][callee.property.name!=/^(warn|error|debug|assert)$/]",
          message: "Unexpected property on console object was called",
        },
        {
          selector: "TSNullKeyword, Literal[raw=null]",
          message:
            "Prefer undefined instead of null. When required for React refs/components, use the `ReactNull` alias. Otherwise, if strictly necessary, disable this error with `// eslint-disable-next-line no-restricted-syntax`. For rationale, see: https://github.com/sindresorhus/meta/discussions/7",
        },
        {
          selector: "CallExpression[callee.name='setTimeout'][arguments.length<2]",
          message: "`setTimeout()` must be invoked with at least two arguments.",
        },
        {
          selector: "CallExpression[callee.name='setInterval'][arguments.length<2]",
          message: "`setInterval()` must be invoked with at least two arguments.",
        },
        {
          selector: "CallExpression[callee.object.name='Promise'][callee.property.name='race']",
          message:
            "Promise.race is banned use `import { race } from \"@lichtblick/den/async\"` instead See: https://github.com/nodejs/node/issues/17469#issuecomment-685216777 https://bugs.chromium.org/p/v8/issues/detail?id=9858",
        },
      ],
      "jest/expect-expect": [
        "error",
        { assertFunctionNames: ["expect*", "sendNotification.expectCalledDuringTest"] },
      ],
    },
  },
  ...typescriptConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
      "@typescript-eslint/explicit-member-accessibility": "error",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unnecessary-type-parameters": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/prefer-regexp-exec": "off",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/unbound-method": ["error", { ignoreStatic: true }],
      "no-loop-func": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          varsIgnorePattern: "^_.",
          argsIgnorePattern: "^_.",
        },
      ],
    },
  },
  {
    files: ["**/*.stories.tsx", "**/*.test.tsx", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/*.stories.tsx"],
    rules: {
      "react/forbid-component-props": "off",
    },
  },
  {
    files: ["**/*.style.ts"],
    rules: {
      "tss-unused-classes/unused-classes": "off",
    },
  },
  {
    files: ["packages/suite-base/src/testing/**"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
  {
    // packages/suite-base/.eslintrc.yaml - webpack resolver for ?raw imports
    files: ["packages/suite-base/**/*.{ts,tsx}"],
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
  {
    // packages/suite-desktop/src/main/.eslintrc.yaml - disable import rules
    files: ["packages/suite-desktop/src/main/**/*.{ts,tsx}"],
    rules: {
      "import/no-unresolved": "off",
      "import/namespace": "off",
      "import/default": "off",
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
    },
  },
  {
    // packages/suite-base/src/players/UserScriptPlayer/transformerWorker/typescript/userUtils/.eslintrc.yaml
    files: ["packages/suite-base/src/players/UserScriptPlayer/transformerWorker/typescript/userUtils/**/*.{ts,tsx}"],
    rules: {
      "@lichtblick/license-header": "off",
    },
  },
];
