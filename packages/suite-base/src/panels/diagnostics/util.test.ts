// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import {
  getDiagnosticId,
  getDisplayName,
  getDiagnosticsByLevel,
  filterAndSortDiagnostics,
  computeDiagnosticInfo,
  LEVELS,
  MAX_STRING_LENGTH,
  DiagnosticsById,
  DiagnosticInfo,
} from "./util";

const watchdogStatus: DiagnosticInfo = {
  status: {
    level: 0,
    name: "status",
    message: "Watchdog is in degraded state 0",
    hardware_id: "watchdog",
    values: [],
  },
  id: "watchdog",
  stamp: { sec: 1547062465, nsec: 999879954 },
  displayName: "watchdog: status",
};
const mctmLogger: DiagnosticInfo = {
  status: {
    level: 0,
    name: "MCTM Logger",
    message: "No triggers since launch!",
    hardware_id: "mctm_logger",
    values: [],
  },
  id: "mctm_logger",
  stamp: { sec: 1547062466, nsec: 1674890 },
  displayName: "mctm_logger: MCTM Logger",
};
const okMap = new Map<string, DiagnosticsById>([
  ["watchdog", new Map([["status", watchdogStatus]])],
  ["mctm_logger", new Map([["MCTM Logger", mctmLogger]])],
]);

const cameraStatus: DiagnosticInfo = {
  status: {
    level: 1,
    name: "status",
    message:
      "Ground rendering using lidar_aligned frame. This is okay for playing back an old bag but NOT okay on the car.",
    hardware_id: "camera_front_left_40/camera_ground_rendering",
    values: [],
  },
  id: "status",
  stamp: { sec: 1547062466, nsec: 37309350 },
  displayName: "camera_front_left_40/camera_ground_rendering: status",
};
const warnMap = new Map([
  ["camera_front_left_40/camera_ground_rendering", new Map([["status", cameraStatus]])],
]);

const usrrStatus: DiagnosticInfo = {
  status: {
    level: 2,
    name: "status",
    message:
      "Error processing raw radar from: USRR Segmentation Node: car velocity exceeds threshold for Usrr Segmentation.",
    hardware_id: "usrr_rear_left_center/usrr_segmentation_node",
    values: [],
  },
  id: "status",
  stamp: { sec: 1547062466, nsec: 98998486 },
  displayName: "usrr_rear_left_center/usrr_segmentation_node: status",
};
const errorMap = new Map<string, DiagnosticsById>([
  ["usrr_rear_left_center/usrr_segmentation_node", new Map([["status", usrrStatus]])],
]);

const diagnosticsByHardwareId = new Map<string, DiagnosticsById>([
  ...okMap,
  ...warnMap,
  ...errorMap,
]);

describe("diagnostics", () => {
  describe("getDiagnosticId", () => {
    it("removes leading slash from hardware_id if present", () => {
      expect(getDiagnosticId("foo", "bar")).toBe("|foo|bar|");
      expect(getDiagnosticId("/foo", "bar")).toBe("|foo|bar|");
      expect(getDiagnosticId("//foo", "bar")).toBe("|/foo|bar|");
      expect(getDiagnosticId("foo", "/bar")).toBe("|foo|/bar|");
    });

    it("doesn't add an extra pipe when no name is provided", () => {
      expect(getDiagnosticId("foo")).toBe("|foo|");
      expect(getDiagnosticId("/foo")).toBe("|foo|");
      expect(getDiagnosticId("//foo")).toBe("|/foo|");
    });
  });

  describe("getDisplayName", () => {
    it("handles hardware_id and name", () => {
      expect(getDisplayName("my_hardware_id", "my_name")).toBe("my_hardware_id: my_name");
    });

    it("handles blank name with hardware_id", () => {
      expect(getDisplayName("my_hardware_id", "")).toBe("my_hardware_id");
    });

    it("handles blank hardware_id with name", () => {
      expect(getDisplayName("", "my_name")).toBe("my_name");
    });

    it("handles blank hardware_id and blank name", () => {
      expect(getDisplayName("", "")).toBe("(empty)");
    });
  });

  describe("getDiagnosticsByLevel", () => {
    it("groups diagnostics by level", () => {
      expect(getDiagnosticsByLevel(diagnosticsByHardwareId)).toStrictEqual(
        new Map([
          [LEVELS.ERROR, [usrrStatus]],
          [LEVELS.OK, [watchdogStatus, mctmLogger]],
          [LEVELS.WARN, [cameraStatus]],
        ]),
      );
    });
  });

  describe("filterAndSortDiagnostics", () => {
    it("sorts nodes that match hardware ID, if present", () => {
      const nodes = getDiagnosticsByLevel(diagnosticsByHardwareId).get(LEVELS.OK);
      if (!nodes) {
        throw new Error("Missing level OK");
      }
      expect(filterAndSortDiagnostics(nodes, "", [])).toStrictEqual([mctmLogger, watchdogStatus]);
      expect(filterAndSortDiagnostics(nodes, "watchdog", [])).toStrictEqual([watchdogStatus]);
      expect(filterAndSortDiagnostics(nodes, "mctm_logger", [])).toStrictEqual([mctmLogger]);
    });

    it("returns filtered nodes ordered by match quality", () => {
      const hardwareIdFilter = "123456";
      const prefixDiagnostic = { ...mctmLogger, displayName: "123456asdfg", id: "1" };
      const subsequenceDiagnostic = { ...mctmLogger, displayName: "1a2s3d4fg5h6", id: "2" };
      const subsequenceButPinnedDiagnostic = { ...mctmLogger, displayName: "12asdfg3456", id: "3" };
      const notSubsequenceDiagnostic = { ...mctmLogger, displayName: "12345", id: "4" };
      expect(
        filterAndSortDiagnostics(
          [
            subsequenceButPinnedDiagnostic,
            notSubsequenceDiagnostic,
            subsequenceDiagnostic,
            prefixDiagnostic,
          ],
          hardwareIdFilter,
          ["3"],
        ),
      ).toEqual([prefixDiagnostic, subsequenceDiagnostic]);
    });
  });

  describe("computeDiagnosticInfo", () => {
    it("trims extremely long value strings", () => {
      expect(
        computeDiagnosticInfo(
          {
            name: "example name",
            hardware_id: "example hardware_id",
            level: 0,
            message: "example message",
            values: [{ key: "example key", value: new Array(10000).join("x") }],
          },
          { sec: 1, nsec: 0 },
        ),
      ).toEqual({
        displayName: "example hardware_id: example name",
        id: "|example hardware_id|example name|",
        stamp: { sec: 1, nsec: 0 },
        status: {
          hardware_id: "example hardware_id",
          level: 0,
          message: "example message",
          name: "example name",
          values: [
            { key: "example key", value: `${new Array(MAX_STRING_LENGTH - 2).join("x")}...` },
          ],
        },
      });
    });
  });
});
