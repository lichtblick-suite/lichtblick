// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export default {
  preset: "ts-jest",
  transform: {
    "\\.tsx?$": "<rootDir>/test/transformers/rawImportPreprocessor.ts",
    "\\.ne$": "<rootDir>/test/transformers/neTransformer.js",
    "\\.(bin|template|wasm)$": "<rootDir>/test/transformers/rawTransformer.js",
  },
  globals: {
    ReactNull: null, // eslint-disable-line no-restricted-syntax
    "ts-jest": {
      babelConfig: {
        plugins: ["babel-plugin-transform-import-meta", "@babel/plugin-transform-modules-commonjs"],
      },
    },
  },
  setupFiles: ["<rootDir>/test/setup.ts", "<rootDir>/test/setupEnzyme.ts", "jest-canvas-mock"],
  setupFilesAfterEnv: ["<rootDir>/test/setupTestFramework.ts"],
  restoreMocks: true,
  moduleNameMapper: {
    "\\.svg$": "<rootDir>/test/mocks/MockSvg.tsx",
    "react-monaco-editor": "<rootDir>/test/stubs/MonacoEditor.tsx",
    "\\.(glb|md|png)$": "<rootDir>/test/mocks/fileMock.ts",
    "\\.(css|scss)$": "<rootDir>/test/mocks/styleMock.ts",
  },
  testRunner: "jest-circus/runner",
};
