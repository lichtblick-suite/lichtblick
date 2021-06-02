// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

// Takes in a string of Typescript code and returns
// beautified, formatted string of Typescript code
async function getPrettifiedCode(code: string): Promise<string> {
  let prettier, parserPlugin;

  // Dynamic imports don't work in node-based jest tests, so require() them instead
  if (process.env.NODE_ENV === "test") {
    prettier = require("prettier/standalone");
    parserPlugin = require("prettier/parser-typescript");
  } else {
    prettier = await import(
      /* webpackChunkName: "prettier" */
      "prettier/standalone"
    );
    parserPlugin = await import(
      /* webpackChunkName: "prettier" */
      "prettier/parser-typescript"
    );
  }

  return prettier.format(code, { parser: "typescript", plugins: [parserPlugin] });
}

export default getPrettifiedCode;
