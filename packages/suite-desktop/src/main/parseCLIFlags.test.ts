// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { parseCLIFlags } from "./parseCLIFlags";

describe("parseCLIFlags", () => {
  it("should parse single flag correctly", () => {
    const argv = ["--flag=value"];
    const result = parseCLIFlags(argv);
    expect(result).toEqual({ flag: "value" });
  });

  it("should parse multiple flags correctly", () => {
    const argv = ["--flag1=value1", "--flag2=value2"];
    const result = parseCLIFlags(argv);
    expect(result).toEqual({ flag1: "value1", flag2: "value2" });
  });

  it("should overwrite duplicated flags", () => {
    const argv = ["--flag=value1", "--flag=value2"];
    const result = parseCLIFlags(argv);
    expect(result).toEqual({ flag: "value2" });
  });

  it("should ignore arguments that do not start with '--'", () => {
    const argv = ["--flag1=value1", "someArg", "someOther=Arg", "--flag2=value2"];
    const result = parseCLIFlags(argv);
    expect(result).toEqual({ flag1: "value1", flag2: "value2" });
  });

  it("should return an empty object if no valid flags are provided", () => {
    const argv = ["someArg", "--flag", "--flag1=", "--=value1"];
    const result = parseCLIFlags(argv);
    expect(result).toEqual({});
  });

  it("should return a readonly object", () => {
    const argv = ["--flag1=value1"];
    const result = parseCLIFlags(argv);
    expect(() => {
      (result as any).flag1 = "newValue";
    }).toThrow();
  });
});
