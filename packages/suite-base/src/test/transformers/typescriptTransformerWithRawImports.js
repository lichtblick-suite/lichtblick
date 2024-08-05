// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const babelJest = require("babel-jest").default;
const fs = require("fs");
const path = require("path");

// look for `?raw` import statements
// re-write these into `const variable = "string source";`;
const importRegEx = /^import (.*) from "(.*)\?raw";$/gm;
function rewriteSource(source, sourcePath) {
  return source.replace(importRegEx, (_, p1, p2) => {
    const resolved = require.resolve(p2, { paths: [path.dirname(sourcePath)] });
    const rawFile = fs.readFileSync(resolved, { encoding: "utf-8" });
    return `const ${p1} = ${JSON.stringify(rawFile.toString())};`;
  });
}

module.exports = {
  createTransformer() {
    const babelJestTransformer = babelJest.createTransformer({ rootMode: "upward" });
    return {
      process(sourceText, sourcePath, opt) {
        return babelJestTransformer.process(rewriteSource(sourceText, sourcePath), sourcePath, opt);
      },
      getCacheKey(sourceText, sourcePath, opt) {
        return babelJestTransformer.getCacheKey(
          rewriteSource(sourceText, sourcePath),
          sourcePath,
          opt,
        );
      },
    };
  },
};
