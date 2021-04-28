// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This script is called *after* we commit an updated yarn.lock file
// We check to see if this was a minor release, and if so we request auto-merge on the PR

import { diff, ReleaseType } from "semver";

import Logger from "@foxglove/log";

import { exec, execOutput } from "./exec";

const log = Logger.getLogger(__filename);

const IGNORE_RELEASE_TYPES: ReleaseType[] = ["major", "premajor"];

export function shouldAutomerge(subject: string): boolean | undefined {
  const [_, prev, curr] = subject.match(/^bump.*from ([^\s]+) to ([^\s]+)\s*$/i) ?? [];

  if (prev == undefined || curr == undefined) {
    return undefined;
  }

  const releaseType = diff(prev, curr);
  if (releaseType == undefined) {
    return undefined;
  }

  return !IGNORE_RELEASE_TYPES.includes(releaseType);
}

export default async function main(): Promise<void> {
  // Get subject of _previous_ commit, since HEAD will be our yarn.lock fix
  const subject = await execOutput("git", ["show", "-s", "--format=%s", "HEAD^"]);

  const merge = shouldAutomerge(subject);
  if (merge === undefined) {
    return log.info(`Not auto-merging (unexpected git commit): '${subject}'`);
  } else if (!merge) {
    return log.info("Not auto-merging (major version upgrade)");
  }

  log.info("Auto-merging (minor version upgrade)");
  await exec("gh", ["pr", "merge", "--squash", "--auto"]);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
