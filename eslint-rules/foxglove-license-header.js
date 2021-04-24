// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// A custom eslint rule checking for the existence of a license header comment, while allowing
// certain prefixes that cannot be moved below the license header.

const ALLOWED_PREFIX_LINES = ["/** @jest-environment jsdom */"];
const LICENSE_HEADER = `
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
`.trim();

module.exports = {
  create: (context) => {
    return {
      Program: () => {
        const source = context.getSourceCode().getText();
        const headerIndex = source.indexOf(LICENSE_HEADER);
        const prefixLines = source.substring(0, headerIndex).trim().split("\n");
        const prefixLinesAreValid = prefixLines.every(
          (line) => line === "" || ALLOWED_PREFIX_LINES.includes(line),
        );
        if (headerIndex === -1 || !prefixLinesAreValid) {
          context.report({
            message: "Missing license header",
            loc: { start: 0, end: +source.indexOf("\n") + 1 },
            fix: () => {
              return { range: [0, 0], text: LICENSE_HEADER + "\n" };
            },
          });
        }
      },
    };
  },
};
