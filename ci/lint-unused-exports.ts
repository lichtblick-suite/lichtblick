// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { info } from "@actions/core";
import path from "path";
import tsUnusedExports from "ts-unused-exports";

// Identify unused exports
//
// An export is considered unused if it is never imported in any source file.
//
// Note: use the "// ts-unused-exports:disable-next-line" comment above an export if you would like to mark it
// as used even though it appears unused. This might happen for exports which are injected via webpack.
async function main(): Promise<void> {
  const results = tsUnusedExports(path.join(__dirname, "../packages/studio-base/tsconfig.json"), [
    "--findCompletelyUnusedFiles",
    "--ignoreLocallyUsed",
  ]);
  const ignorePathsRegex = new RegExp(
    [
      String.raw`\.stories\.tsx?$`,
      String.raw`packages/studio-base/src/index\.ts`,
      String.raw`packages/studio-base/src/panels/ThreeDeeRender/transforms/index\.ts`, // `export *` is not correctly analyzed <https://github.com/pzavolinsky/ts-unused-exports/issues/286>
      String.raw`packages/studio-base/src/test/`,
      String.raw`packages/studio-base/src/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/`,
    ].join("|"),
  );

  const repoRootPath = path.resolve(__dirname, "..");
  let hasUnusedExports = false;
  for (const [filePath, items] of Object.entries(results)) {
    if (filePath === "unusedFiles") {
      continue;
    }
    const pathFromRepoRoot = path.relative(repoRootPath, filePath);
    if (ignorePathsRegex.test(pathFromRepoRoot)) {
      continue;
    }
    for (const item of items) {
      // In reality, sometimes item.location is undefined
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (item.location == undefined) {
        info(
          `::error file=${pathFromRepoRoot}::Unused export ${item.exportName} in ${pathFromRepoRoot}`,
        );
      } else {
        info(
          `::error file=${pathFromRepoRoot},line=${item.location.line},col=${item.location.character}::Unused export ${item.exportName} in ${pathFromRepoRoot}:${item.location.line}:${item.location.character}`,
        );
      }
      hasUnusedExports = true;
    }
  }

  for (const filePath of results.unusedFiles ?? []) {
    const pathFromRepoRoot = path.relative(repoRootPath, filePath);
    if (ignorePathsRegex.test(pathFromRepoRoot)) {
      continue;
    }
    info(`::error file=${pathFromRepoRoot}::Unused file ${pathFromRepoRoot}`);
    hasUnusedExports = true;
  }
  process.exit(hasUnusedExports ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
