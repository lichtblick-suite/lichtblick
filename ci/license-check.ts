// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import checker from "license-checker";
import path from "path";
import { promisify } from "util";

const initChecker = promisify(checker.init);

const ALLOWED_LICENSES = [
  "MPL-2.0",
  "MIT",
  "BSD",
  "BSD-2-clause",
  "Apache",
  "ISC",
  "Python-2.0",
  "PSF",
  "CC-BY",
  "CC0",
  "Public Domain",
  "WTFPL",
  "Unlicense",
  "OFL-1.1",
];

const EXCLUDED_PACKAGES = ["gl-vec3@1.1.3"];

async function main() {
  const output = await initChecker({
    start: path.join(__dirname, ".."),
    summary: true,
    onlyAllow: ALLOWED_LICENSES.join(";"),
    excludePackages: EXCLUDED_PACKAGES.join(";"),
    excludePrivatePackages: true,
    color: false,
  });

  // eslint-disable-next-line
  console.log((checker as any).asSummary(output));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
