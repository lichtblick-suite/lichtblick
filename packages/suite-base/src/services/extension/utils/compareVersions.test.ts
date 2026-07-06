// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import compareVersions from "./compareVersions";

describe("compareVersions", () => {
  describe("equal versions", () => {
    it("should return 0 for identical versions", () => {
      expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    });

    it("should return 0 for versions with trailing zeros", () => {
      expect(compareVersions("1.2.0", "1.2")).toBe(0);
    });

    it("should return 0 for single digit versions", () => {
      expect(compareVersions("1", "1")).toBe(0);
    });

    it("should return 0 for multi-part equal versions", () => {
      expect(compareVersions("1.0.0.0", "1.0.0.0")).toBe(0);
    });
  });

  describe("v1 greater than v2", () => {
    it("should return 1 when v1 major version is greater", () => {
      expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    });

    it("should return 1 when v1 minor version is greater", () => {
      expect(compareVersions("1.3.0", "1.2.9")).toBe(1);
    });

    it("should return 1 when v1 patch version is greater", () => {
      expect(compareVersions("1.2.4", "1.2.3")).toBe(1);
    });

    it("should return 1 when v1 has more parts and is greater", () => {
      expect(compareVersions("1.2.3.1", "1.2.3")).toBe(1);
    });

    it("should return 1 for larger version numbers", () => {
      expect(compareVersions("10.0.0", "9.0.0")).toBe(1);
    });
  });

  describe("v1 less than v2", () => {
    it("should return -1 when v1 major version is less", () => {
      expect(compareVersions("1.9.9", "2.0.0")).toBe(-1);
    });

    it("should return -1 when v1 minor version is less", () => {
      expect(compareVersions("1.2.9", "1.3.0")).toBe(-1);
    });

    it("should return -1 when v1 patch version is less", () => {
      expect(compareVersions("1.2.3", "1.2.4")).toBe(-1);
    });

    it("should return -1 when v1 has fewer parts", () => {
      expect(compareVersions("1.2.3", "1.2.3.1")).toBe(-1);
    });

    it("should return -1 for smaller version numbers", () => {
      expect(compareVersions("9.0.0", "10.0.0")).toBe(-1);
    });
  });

  describe("invalid versions", () => {
    it("should return NaN for non-numeric v1", () => {
      expect(compareVersions("1.2.a", "1.2.3")).toBe(NaN);
    });

    it("should return NaN for non-numeric v2", () => {
      expect(compareVersions("1.2.3", "1.2.b")).toBe(NaN);
    });

    it("should return NaN for both non-numeric", () => {
      expect(compareVersions("a.b.c", "x.y.z")).toBe(NaN);
    });

    it("should return NaN for versions with special characters", () => {
      expect(compareVersions("1.2-beta", "1.2.3")).toBe(NaN);
    });

    it("should return NaN for empty parts", () => {
      expect(compareVersions("1..3", "1.2.3")).toBe(NaN);
    });
  });
});
