// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { isTime, toSec } from "@lichtblick/rostime";
import { Time } from "@lichtblick/suite";
import { getChartValue, isChartValue } from "@lichtblick/suite-base/panels/Plot/utils/datum";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/rostime", () => ({
  isTime: jest.fn(),
  toSec: jest.fn(),
}));

describe("Chart Value Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMocks = (options: {
    isTimeMockReturnValue: boolean;
    toSecMockReturnValue?: number;
  }) => {
    (isTime as unknown as jest.Mock).mockReturnValue(options.isTimeMockReturnValue);
    if (options.toSecMockReturnValue != undefined) {
      (toSec as jest.Mock).mockReturnValue(options.toSecMockReturnValue);
    }
  };

  describe("isChartValue", () => {
    it("should return true for valid types: bigint, boolean, number, string", () => {
      expect(isChartValue(42n)).toBe(true);
      expect(isChartValue(true)).toBe(true);
      expect(isChartValue(3.14)).toBe(true);
      expect(isChartValue(BasicBuilder.string())).toBe(true);
    });

    it("should return true for Time objects", () => {
      const time: Time = { sec: 10, nsec: 500 };
      setupMocks({ isTimeMockReturnValue: true });

      expect(isChartValue(time)).toBe(true);
      expect(isTime).toHaveBeenCalledWith(time);
    });

    it("should return false for unsupported object types", () => {
      setupMocks({ isTimeMockReturnValue: false });
      expect(isChartValue({})).toBe(false);
    });

    it("should return false for unsupported types", () => {
      expect(isChartValue(undefined)).toBe(false);
      expect(isChartValue(Symbol(BasicBuilder.string()))).toBe(false);
      expect(isChartValue(() => {})).toBe(false);
    });
  });

  describe("getChartValue", () => {
    it("should correctly convert bigint, boolean, number, and string", () => {
      expect(getChartValue(42n)).toBe(42);
      expect(getChartValue(true)).toBe(1);
      expect(getChartValue(false)).toBe(0);
      expect(getChartValue(3.14)).toBe(3.14);
      expect(getChartValue("42")).toBe(42);
      expect(getChartValue("3.14")).toBe(3.14);
      expect(getChartValue("not-a-number")).toBeNaN();
    });

    it("should return the correct value for Time objects", () => {
      const time: Time = { sec: 10, nsec: 500 };
      setupMocks({ isTimeMockReturnValue: true, toSecMockReturnValue: 10.5 });

      expect(getChartValue(time)).toBe(10.5);
      expect(isTime).toHaveBeenCalledWith(time);
      expect(toSec).toHaveBeenCalledWith(time);
    });

    it("should return undefined for unsupported object types", () => {
      setupMocks({ isTimeMockReturnValue: false });
      expect(getChartValue({})).toBeUndefined();
    });

    it("should return undefined for unsupported types", () => {
      expect(getChartValue(undefined)).toBeUndefined();
      expect(getChartValue(Symbol(BasicBuilder.string()))).toBeUndefined();
      expect(getChartValue(() => {})).toBeUndefined();
    });
  });
});
