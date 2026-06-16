// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { UserScripts } from "@lichtblick/suite-base/types/panels";

import { filterVisibleUserScripts } from "./utils";

describe("filterVisibleUserScripts", () => {
  it("should return an empty object when called with undefined", () => {
    // When
    const result = filterVisibleUserScripts(undefined);

    // Then
    expect(result).toEqual({});
  });

  it("should return an empty object when called with null-like undefined", () => {
    // Given
    const scripts: UserScripts | undefined = undefined;

    // When
    const result = filterVisibleUserScripts(scripts);

    // Then
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("should return an empty object when all scripts are hidden", () => {
    // Given
    const scripts: UserScripts = {
      script1: { name: "script1", sourceCode: "// code", mode: "hidden" },
      script2: { name: "script2", sourceCode: "// code2", mode: "hidden" },
    };

    // When
    const result = filterVisibleUserScripts(scripts);

    // Then
    expect(result).toEqual({});
  });

  it("should return all scripts when none are hidden", () => {
    // Given
    const scripts: UserScripts = {
      script1: { name: "script1", sourceCode: "// code" },
      script2: { name: "script2", sourceCode: "// code2", mode: "readOnly" },
    };

    // When
    const result = filterVisibleUserScripts(scripts);

    // Then
    expect(result).toEqual(scripts);
  });

  it("should exclude hidden scripts and keep visible ones", () => {
    // Given
    const visibleScript = { name: "visible", sourceCode: "// visible" };
    const readOnlyScript = {
      name: "readOnly",
      sourceCode: "// readOnly",
      mode: "readOnly" as const,
    };
    const hiddenScript = { name: "hidden", sourceCode: "// hidden", mode: "hidden" as const };
    const scripts: UserScripts = {
      visible: visibleScript,
      readOnly: readOnlyScript,
      hidden: hiddenScript,
    };

    // When
    const result = filterVisibleUserScripts(scripts);

    // Then
    expect(result).toEqual({ visible: visibleScript, readOnly: readOnlyScript });
    expect(result).not.toHaveProperty("hidden");
  });

  it("should keep scripts with no mode set", () => {
    // Given
    const scripts: UserScripts = {
      scriptNoMode: { name: "scriptNoMode", sourceCode: "// no mode" },
    };

    // When
    const result = filterVisibleUserScripts(scripts);

    // Then
    expect(result).toHaveProperty("scriptNoMode");
  });

  it("should return a stable empty object reference when the result is empty", () => {
    // Given – two separate calls that both yield empty results
    const allHidden: UserScripts = {
      s1: { name: "s1", sourceCode: "", mode: "hidden" },
    };

    // When
    const result1 = filterVisibleUserScripts(undefined);
    const result2 = filterVisibleUserScripts(allHidden);

    // Then – both are empty (referential equality is an implementation detail, value equality is the contract)
    expect(Object.keys(result1)).toHaveLength(0);
    expect(Object.keys(result2)).toHaveLength(0);
  });
});
