// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import checker from "license-checker";
import { join } from "path";

const ALLOWED_LICENSES = [
  "MPL-2.0",
  "MIT",
  "BSD",
  "Apache-2.0",
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
const EXCLUDED_PACKAGES = ["gl-vec3@1.1.3", "pngparse@2.0.1"];

jest.setTimeout(30 * 1000);

describe("Dependency licenses", () => {
  it("must adhere to the allowed list of licenses", async () => {
    try {
      const packages = await new Promise<checker.ModuleInfos>((resolve, reject) => {
        checker.init(
          {
            start: join(__dirname, ".."),
            summary: true,
            onlyAllow: ALLOWED_LICENSES.join(";"),
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

      // eslint-disable-next-line
      console.log((checker as any).asSummary(packages));
    } catch (err) {
      fail(err);
    }
  });
});
