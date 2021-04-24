// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable @typescript-eslint/no-var-requires */
const babelJest = require("babel-jest").default;
const fs = require("fs");

// look for `?raw` import statements
// re-write these into `const variable = "string source";`;
const importRegEx = /^import (.*) from "(.*)\?raw";$/gm;
const importReplacer = (_, p1, p2) => {
  const resolved = require.resolve(p2);
  const rawFile = fs.readFileSync(resolved, { encoding: "utf-8" });
  return `const ${p1} = ${JSON.stringify(rawFile.toString())};`;
};

function rewriteSource(source) {
  return source.replace(importRegEx, importReplacer);
}

module.exports = {
  process(sourceText, ...args) {
    return babelJest.process(rewriteSource(sourceText), ...args);
  },
  getCacheKey(sourceText, ...args) {
    return babelJest.getCacheKey(rewriteSource(sourceText), ...args);
  },
};
