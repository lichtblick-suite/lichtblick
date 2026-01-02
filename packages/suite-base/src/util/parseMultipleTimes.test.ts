// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import moment from "moment-timezone";

import { parseTimestampStr } from "./parseMultipleTimes";

describe("parseTimestampStr", () => {
  const originalTz = moment.tz.guess();

  beforeEach(() => {
    // Set default timezone to UTC for consistent results across different environments
    moment.tz.setDefault("UTC");
  });

  afterEach(() => {
    // Restore original timezone
    moment.tz.setDefault(originalTz);
  });

  it("should return the same number if input is a Unix timestamp in seconds", () => {
    expect(parseTimestampStr("1633046400")).toEqual({ sec: 1633046400, nsec: 0 });
  });

  it("should start in 01/01/1970 at 01:00:01", () => {
    expect(parseTimestampStr("1970-01-01 00:00:01")).toEqual({ sec: 1, nsec: 0 });
    expect(parseTimestampStr("1970-01-01 00:00:00")).toBeUndefined();
  });

  describe("parse valid date strings and return Unix timestamps in seconds", () => {
    it("should return Unix timestamp in seconds with default timezone (UTC)", () => {
      expect(parseTimestampStr("2020-04-07 11:45:21 PM")).toEqual({ sec: 1586303121, nsec: 0 });
      expect(parseTimestampStr("2024-12-02 11:45:21.325123 PM")).toEqual({
        sec: 1733183121,
        nsec: 325000000,
      });
      expect(parseTimestampStr("2024-12-02 11:45:21.325123")).toEqual({
        sec: 1733139921,
        nsec: 325000000,
      });
      expect(parseTimestampStr("2024-12-02 11:45:21")).toEqual({ sec: 1733139921, nsec: 0 });
      expect(parseTimestampStr("2024-12-02 11:45")).toEqual({ sec: 1733139900, nsec: 0 });
      expect(parseTimestampStr("2024-12-02")).toEqual({ sec: 1733097600, nsec: 0 });
    });

    it("should return Unix timestamp with CET timezone", () => {
      expect(parseTimestampStr("2024-12-02 11:45:21 CET")).toEqual({
        sec: 1733139921,
        nsec: 0,
      });
      expect(parseTimestampStr("2024-12-02 11:45:21.325123 CET")).toEqual({
        sec: 1733139921,
        nsec: 325000000,
      });
    });

    it("should return the same timestamp for equivalent times in CET and WET", () => {
      const timestampWithoutTimezone = parseTimestampStr("2024-12-02 10:45:21");
      const timestampWithCET = parseTimestampStr("2024-12-02 10:45:21 CET");
      const timestampWithWET = parseTimestampStr("2024-12-02 10:45:21 WET");

      expect(timestampWithoutTimezone).toEqual(timestampWithCET);
      expect(timestampWithoutTimezone).toEqual(timestampWithWET);
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
