// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePathFilter, OperatorType } from "@lichtblick/message-path";
import { Immutable } from "@lichtblick/suite";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import { filterMatches } from "./filterMatches";

describe("filterMatches", () => {
  function setup(overrides: Partial<MessagePathFilter> = {}): Immutable<MessagePathFilter> {
    return {
      path: ["a"],
      value: BasicBuilder.number(),
      operator: "==",
      type: "filter",
      nameLoc: BasicBuilder.number(),
      valueLoc: BasicBuilder.number(),
      repr: "",
      ...overrides,
    };
  }

  describe("value matching", () => {
    it("returns false for undefined value", () => {
      const filter = setup();
      expect(filterMatches(filter, undefined)).toBe(false);
    });

    it("returns false for empty path and undefined value", () => {
      const filter = setup({ path: [] });
      expect(filterMatches(filter, undefined)).toBe(false);
    });

    it("returns error when filter value is an object", () => {
      const filter = setup({
        value: { variableName: BasicBuilder.string(), startLoc: BasicBuilder.number() },
      });
      expect(() => filterMatches(filter, { a: BasicBuilder.number() })).toThrow(
        new Error("filterMatches only works on paths where global variables have been filled in"),
      );
    });

    it("returns false for undefined filter value", () => {
      const filter = setup({ value: undefined });
      expect(filterMatches(filter, { a: BasicBuilder.number() })).toBe(false);
    });

    it("returns false for non-matching value", () => {
      const value = BasicBuilder.number();
      const secondValue = value + 1;
      const filter = setup({ value });
      expect(filterMatches(filter, { a: secondValue })).toBe(false);
    });

    it("returns true for matching value", () => {
      const value = BasicBuilder.number();
      const filter = setup({ value });
      expect(filterMatches(filter, { a: value })).toBe(true);
    });
  });

  describe("nested value matching", () => {
    it("returns false for non-matching or missing nested value", () => {
      const value = BasicBuilder.number();
      const filter = setup({ path: ["a", "b"], value });
      expect(filterMatches(filter, { a: { b: value + 1 } })).toBe(false);
      expect(filterMatches(filter, { a: {} })).toBe(false);
      expect(filterMatches(filter, { a: { b: {} } })).toBe(false);
    });

    it("returns true for matching nested value", () => {
      const value = BasicBuilder.number();
      const filter = setup({ path: ["a", "b"], value });
      expect(filterMatches(filter, { a: { b: value } })).toBe(true);
    });
  });

  describe("operator matching", () => {
    it.each([
      ["==", 1, 1, true],
      ["==", 1, 2, false],
      ["!=", 1, 1, false],
      ["!=", 1, 2, true],
      [">", 2, 1, true],
      [">=", 2, 1, true],
      [">=", 1, 1, true],
      [">=", 1, 2, false],
      ["<", 1, 2, true],
      ["<", 2, 1, false],
      ["<=", 1, 2, true],
      ["<=", 1, 1, true],
      ["<=", 2, 1, false],
    ])("returns %s for %s %s %s", (operator, testValue, filterValue, expectedResult) => {
      const filter = setup({ value: filterValue, operator: operator as OperatorType });
      expect(filterMatches(filter, { a: testValue })).toBe(expectedResult);
    });

    it("returns false for invalid operator", () => {
      const filter = setup({ value: BasicBuilder.number(), operator: "invalid" as any });
      expect(filterMatches(filter, { a: BasicBuilder.number() })).toBe(false);
    });
  });
});
