// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { info } from "@actions/core";

import { execOutput } from "./exec";

async function main(): Promise<void> {
  const { stdout, status } = await execOutput(
    "ts-prune",
    [
      "-p",
      "packages/studio-base/tsconfig.json",
      "--error",
      "--ignore",
      `used in module|^packages/(hooks|den)/|/studio-base/src/index.ts|/studio-base/src/test/mocks/|studio-base/src/test/stubs/|/nodeTransformerWorker/typescript/userUtils|\\.stories\\.ts|/\\.storybook/`,
    ],
    { ignoreReturnCode: true },
  );
  const lines = stdout.trim().split("\n");
  for (const line of lines) {
    // cf. https://github.com/nadeesha/ts-prune/blob/45c6be7e8db44f2421cc57b52e50e8ea4e402782/src/presenter.ts#L8
    const match = /^(.+):(\d+) - (.+)$/.exec(line);
    if (match && (process.env.CI ?? "") !== "") {
      info(`::error file=${match[1]},line=${match[2]}::Unused export ${match[3]}`);
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
