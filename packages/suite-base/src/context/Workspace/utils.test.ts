// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { normalizeExtensions } from "./utils";

describe("normalizeExtensions", () => {
  it("should add dot to extensions without leading dot", () => {
    expect(normalizeExtensions(["txt", "json"])).toEqual([".txt", ".json"]);
  });

  it("should leave extensions with leading dot unchanged", () => {
    expect(normalizeExtensions([".png", ".jpg"])).toEqual([".png", ".jpg"]);
  });

  it("should handle mixed extensions", () => {
    expect(normalizeExtensions([".md", "csv"])).toEqual([".md", ".csv"]);
  });

  it("should return empty array for empty input", () => {
    expect(normalizeExtensions([])).toEqual([]);
  });
});
