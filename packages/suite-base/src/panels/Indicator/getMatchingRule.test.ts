// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getMatchingRule } from "./getMatchingRule";
import { Rule } from "./types";

describe("getMatchingRule", () => {
  it.each([
    [true, "True"],
    ["true", "True"],
    [false, "False"],
    ["false", "False"],
    ["hello", "Hello"],
    [-1.5, "Negative float"],
    [100000000000000000000, "Large int"],
    [100000000000000000001n, "Large int"],
    [-1.4, undefined],
  ])("matches %s with %s", (value, expectedLabel) => {
    const rules: Rule[] = [
      {
        rawValue: "hello",
        operator: "=",
        color: "orange",
        label: "Hello",
      },
      {
        rawValue: "true",
        operator: "=",
        color: "red",
        label: "True",
      },
      {
        rawValue: "false",
        operator: "=",
        color: "green",
        label: "False",
      },
      {
        rawValue: "-1.5",
        operator: "=",
        color: "blue",
        label: "Negative float",
      },
      {
        rawValue: "100000000000000000001",
        operator: "=",
        color: "blue",
        label: "Large int",
      },
    ];

    expect(getMatchingRule(value, rules)?.label).toEqual(expectedLabel);
  });

  it("implements operators", () => {
    expect(
      getMatchingRule(1, [{ operator: "=", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();
    expect(
      getMatchingRule(2, [{ operator: "=", rawValue: "2", color: "", label: "" }]),
    ).toBeTruthy();
    expect(
      getMatchingRule(3, [{ operator: "=", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();

    expect(
      getMatchingRule(1, [{ operator: "<", rawValue: "2", color: "", label: "" }]),
    ).toBeTruthy();
    expect(
      getMatchingRule(2, [{ operator: "<", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();
    expect(
      getMatchingRule(3, [{ operator: "<", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();

    expect(
      getMatchingRule(1, [{ operator: ">", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();
    expect(
      getMatchingRule(2, [{ operator: ">", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();
    expect(
      getMatchingRule(3, [{ operator: ">", rawValue: "2", color: "", label: "" }]),
    ).toBeTruthy();

    expect(
      getMatchingRule(1, [{ operator: "<=", rawValue: "2", color: "", label: "" }]),
    ).toBeTruthy();
    expect(
      getMatchingRule(2, [{ operator: "<=", rawValue: "2", color: "", label: "" }]),
    ).toBeTruthy();
    expect(
      getMatchingRule(3, [{ operator: "<=", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();

    expect(
      getMatchingRule(1, [{ operator: ">=", rawValue: "2", color: "", label: "" }]),
    ).toBeFalsy();
    expect(
      getMatchingRule(2, [{ operator: ">=", rawValue: "2", color: "", label: "" }]),
    ).toBeTruthy();
    expect(
      getMatchingRule(3, [{ operator: ">=", rawValue: "2", color: "", label: "" }]),
    ).toBeTruthy();
  });

  it("returns first matching rule", () => {
    expect(
      getMatchingRule(4, [
        { operator: ">", rawValue: "2", color: "", label: "first" },
        { operator: ">", rawValue: "3", color: "", label: "second" },
      ])?.label,
    ).toEqual("first");

    expect(
      getMatchingRule(4, [
        { operator: ">", rawValue: "3", color: "", label: "second" },
        { operator: ">", rawValue: "2", color: "", label: "first" },
      ])?.label,
    ).toEqual("second");
  });
});
