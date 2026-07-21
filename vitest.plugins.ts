// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import fs from "node:fs";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

const require = createRequire(__filename);

/**
 * Compiles nearley (`.ne`) grammar files to JavaScript on import.
 *
 * Replaces the Jest `neTransformer.js` transformer.
 */
export function nearleyPlugin(): Plugin {
  return {
    name: "lichtblick:nearley",
    enforce: "pre",
    transform(source, id) {
      if (!id.split("?")[0]!.endsWith(".ne")) {
        return undefined;
      }

      // From https://nearley.js.org/docs/using-in-frontend
      const nearley = require("nearley");
      const compile = require("nearley/lib/compile");
      const generate = require("nearley/lib/generate");
      const nearleyGrammar = require("nearley/lib/nearley-language-bootstrapped");

      const grammarParser = new nearley.Parser(nearleyGrammar);
      grammarParser.feed(source);
      const grammarAst = grammarParser.results[0];
      const grammarInfoObject = compile(grammarAst, {});
      const grammarJs = generate(grammarInfoObject, "grammar");

      return { code: grammarJs, map: null };
    },
  };
}

/**
 * Imports binary-like assets (`.bin`, `.template`, `.wasm`) as raw strings.
 *
 * Replaces the Jest `rawTransformer.js` transformer.
 */
export function rawBinaryPlugin(): Plugin {
  const extensions = /\.(bin|template|wasm)$/;
  return {
    name: "lichtblick:raw-binary",
    enforce: "pre",
    load(id) {
      const cleanId = id.split("?")[0]!;
      if (!extensions.test(cleanId)) {
        return undefined;
      }

      const content = fs.readFileSync(cleanId, { encoding: "utf-8" });
      return `export default ${JSON.stringify(content)};`;
    },
  };
}

/**
 * Redirects asset and heavy-dependency imports to lightweight test mocks.
 *
 * Replaces the Jest `moduleNameMapper` entries for svg/css/glb/md/png assets and
 * the `react-monaco-editor` stub.
 */
export function assetMocksPlugin(mocks: {
  svg: string;
  css: string;
  file: string;
  monacoEditor: string;
}): Plugin {
  return {
    name: "lichtblick:asset-mocks",
    enforce: "pre",
    resolveId(source) {
      const cleanSource = source.split("?")[0]!;
      if (source === "react-monaco-editor") {
        return mocks.monacoEditor;
      }
      if (cleanSource.endsWith(".svg")) {
        return mocks.svg;
      }
      if (cleanSource.endsWith(".css")) {
        return mocks.css;
      }
      if (/\.(glb|md|png)$/.test(cleanSource)) {
        return mocks.file;
      }
      return undefined;
    },
  };
}
