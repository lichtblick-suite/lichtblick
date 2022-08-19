// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { info } from "@actions/core";

import { execOutput } from "./exec";

// Identify unused exports
//
// An export is considered unused if it is never imported in any source file.
//
// Note: use the "// ts-prune-ignore-next" comment above an export if you would like to mark it
// as used even though it appears unused. This might happen for exports which are injected via webpack.
async function main(): Promise<void> {
  const { stdout, status } = await execOutput(
    "ts-prune",
    [
      "-p",
      "packages/studio-base/tsconfig.json",
      "--error",
      "--ignore",
      String.raw`used in module|^packages/(hooks|den|mcap|mcap-support)/|/studio-base/src/index\.ts|/studio-base/src/stories/|/studio-base/src/test/|/ThreeDeeRender/transforms/index\.ts|/nodeTransformerWorker/typescript/userUtils|\.stories\.ts|/\.storybook/|/storySupport/`,

      // --skip means don't consider exports used if they are only used in these files
      "--skip",
      String.raw`\.test\.ts|\.stories\.tsx`,
    ],
    { ignoreReturnCode: true },
  );
  const lines = stdout.trim().split("\n");
  for (const line of lines) {
    // cf. https://github.com/nadeesha/ts-prune/blob/45c6be7e8db44f2421cc57b52e50e8ea4e402782/src/presenter.ts#L8
    const match = /^(.+):(\d+) - (.+)$/.exec(line);
    if (match && (process.env.CI ?? "") !== "") {
      info(`::error file=${match[1]},line=${match[2]}::Unused export ${match[3]} in ${match[1]}`);
    } else {
      info(line);
    }
  }
  process.exit(status);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
