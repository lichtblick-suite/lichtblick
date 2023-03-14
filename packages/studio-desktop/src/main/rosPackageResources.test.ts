// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";

import { findRosPackage, rosPackageNameAtPath } from "./rosPackageResources";

const FIXTURES_ROOT = path.join(__dirname, "./fixtures");
const PACKAGES_ROOT = path.join(FIXTURES_ROOT, "./packages");

describe("rosPackageResources", () => {
  describe("rosPackageNameAtPath", () => {
    it("should read package name from package.xml file at path", async () => {
      const name = await rosPackageNameAtPath(path.join(PACKAGES_ROOT, "./foo"));
      expect(name).toEqual("foo");
    });
  });

  describe("findRosPackage", () => {
    it("should find package within rosPackagePath", async () => {
      const packagePath = await findRosPackage("foo", { rosPackagePath: PACKAGES_ROOT });
      expect(packagePath).toEqual(path.join(PACKAGES_ROOT, "./foo"));
    });

    it("should find package within multiple rosPackagePaths", async () => {
      const packagePath = await findRosPackage("foo", {
        rosPackagePath: `${FIXTURES_ROOT}${path.delimiter}${PACKAGES_ROOT}`,
      });
      expect(packagePath).toEqual(path.join(PACKAGES_ROOT, "./foo"));
    });

    it("should find package within process.env.ROS_PACKAGE_PATH", async () => {
      process.env.ROS_PACKAGE_PATH = `${FIXTURES_ROOT}${path.delimiter}${PACKAGES_ROOT}`;
      try {
        const packagePath = await findRosPackage("foo");
        expect(packagePath).toEqual(path.join(PACKAGES_ROOT, "./foo"));
      } finally {
        process.env.ROS_PACKAGE_PATH = undefined;
      }
    });

    it("should find packages recursively within rosPackagePath", async () => {
      const packagePath = await findRosPackage("nested-child", {
        rosPackagePath: PACKAGES_ROOT,
      });
      expect(packagePath).toEqual(path.join(PACKAGES_ROOT, "nested", "child"));
    });
  });
});
