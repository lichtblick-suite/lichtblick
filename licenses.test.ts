// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import checker from "license-checker";
import { join } from "path";

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
  "Hippocratic-2.1",
];
const EXCLUDED_PACKAGES = ["gl-vec3@1.1.3", "pngparse@2.0.1"];

jest.setTimeout(30 * 1000);

describe("Dependency licenses", () => {
  it("must adhere to the allowed list of licenses", async () => {
    // await printLicenses();
    await checkLicenses(ALLOWED_LICENSES.join(";"));
  });
});

// Uncomment this and the printLicenses() call above to print the full list of
// found licenses. This can be helpful when debugging failures for this test
// async function printLicenses() {
//   // eslint-disable-next-line
//   console.log((checker as any).asSummary(await checkLicenses()));
// }

function checkLicenses(onlyAllow?: string): Promise<checker.ModuleInfos> {
  return new Promise<checker.ModuleInfos>((resolve, reject) => {
    checker.init(
      {
        start: join(__dirname),
        summary: true,
        onlyAllow,
        excludePackages: EXCLUDED_PACKAGES.join(";"),
        excludePrivatePackages: true,
        color: false,
      },
      (err, modules) => {
        if (err != undefined) {
          reject(err);
          return;
        }
        resolve(modules);
      },
    );
  });
}
