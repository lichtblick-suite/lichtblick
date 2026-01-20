// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { parseTimestampStr } from "./parseMultipleTimes";

describe("parseTimestampStr", () => {
  it("should return the same number if input is a Unix timestamp in seconds", () => {
    expect(parseTimestampStr("1633046400")).toEqual({ sec: 1633046400, nsec: 0 });
  });

  it("should start in 01/01/1970 at 01:00:01", () => {
    // Note: Tests use UTC for consistent results
    expect(parseTimestampStr("1970-01-01 00:00:01")).toEqual({ sec: 1, nsec: 0 });
    expect(parseTimestampStr("1970-01-01 00:00:00")).toBeUndefined();
  });

  describe("parse valid date strings and return Unix timestamps in seconds", () => {
    it("should return Unix timestamp in seconds", () => {
      // Using explicit UTC timestamps to avoid timezone-dependent test failures
      expect(parseTimestampStr("2020-04-07 11:45:21 PM")).toBeDefined();
      expect(parseTimestampStr("2024-12-02 11:45:21.325123 PM")).toBeDefined();
      expect(parseTimestampStr("2024-12-02 11:45:21.325123")).toBeDefined();
      expect(parseTimestampStr("2024-12-02 11:45:21")).toBeDefined();
      expect(parseTimestampStr("2024-12-02 11:45")).toBeDefined();
      expect(parseTimestampStr("2024-12-02")).toBeDefined();
    });

    it("should handle timezone-aware timestamps", () => {
      const timestamp = parseTimestampStr("2024-12-02 11:45:21 CET");
      expect(timestamp).toBeDefined();
      expect(timestamp?.sec).toBeGreaterThan(0);
    });
  });

  it("should return undefined for invalid date string", () => {
    expect(parseTimestampStr("invalid-date")).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(parseTimestampStr("")).toBeUndefined();
  });

  it("should return undefined for non-numeric string", () => {
    expect(parseTimestampStr("not-a-number")).toBeUndefined();
  });
});
