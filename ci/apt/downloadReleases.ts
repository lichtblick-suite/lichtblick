// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Octokit } from "@octokit/rest";

import { exec } from "../exec";

const NUM_VERSIONS_TO_PUBLISH = 5;

// Identify unused exports
//
// An export is considered unused if it is never imported in any source file.
//
// Note: use the "// ts-prune-ignore-next" comment above an export if you would like to mark it
// as used even though it appears unused. This might happen for exports which are injected via webpack.
async function main(): Promise<void> {
  // Create packages directory
  await exec("mkdir", ["-p", "packages"]);

  // Fetch recent releases
  const octokit = new Octokit();
  const releases = await octokit.rest.repos.listReleases({
    owner: "foxglove",
    repo: "studio",
  });

  // Filter out pre-releases
  for (const release of releases.data
    .filter((r) => !r.prerelease)
    .slice(0, NUM_VERSIONS_TO_PUBLISH)) {
    for (const asset of release.assets) {
      // Download debs for this release
      if (asset.name.match(/\.(deb|snap)$/)) {
        await exec("curl", ["-fsSL", "-o", `packages/${asset.name}`, asset.browser_download_url]);
      }
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
