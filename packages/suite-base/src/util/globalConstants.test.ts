// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useTheme } from "@mui/material";

import { getValueColor, useJsonTreeTheme } from "./globalConstants";

jest.mock("@mui/material", () => ({
  useTheme: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/util/constants", () => ({
  JSON_TREE_THEME_COLORS: {
    light: {
      null: "#808080",
      string: "#0000FF",
      number: "#FF0000",
      text: "#000000",
      label: "#008000",
    },
    dark: {
      null: "#C0C0C0",
      string: "#87CEEB",
      number: "#FF6347",
      text: "#FFFFFF",
      label: "#90EE90",
    },
  },
}));

describe("getValueColor", () => {
  it("should return null color for undefined", () => {
    const color = getValueColor(undefined, "light");
    expect(color).toBe("#808080");
  });

  it("should return null color for null", () => {
    // eslint-disable-next-line no-restricted-syntax
    const color = getValueColor(null, "light");
    expect(color).toBe("#808080");
  });

  it("should return string color for string values", () => {
    expect(getValueColor("hello", "light")).toBe("#0000FF");
    expect(getValueColor("", "light")).toBe("#0000FF");
  });

  it("should return number color for number values", () => {
    expect(getValueColor(42, "light")).toBe("#FF0000");
    expect(getValueColor(0, "light")).toBe("#FF0000");
    expect(getValueColor(-3.14, "light")).toBe("#FF0000");
  });

  it("should return number color for bigint values", () => {
    expect(getValueColor(BigInt(123), "light")).toBe("#FF0000");
  });

  it("should return number color for boolean values", () => {
    expect(getValueColor(true, "light")).toBe("#FF0000");
    expect(getValueColor(false, "light")).toBe("#FF0000");
  });

  it("should return undefined for object types", () => {
    expect(getValueColor({}, "light")).toBeUndefined();
    expect(getValueColor([], "light")).toBeUndefined();
    expect(getValueColor(new Date(), "light")).toBeUndefined();
  });

  it("should respect dark mode", () => {
    expect(getValueColor(undefined, "dark")).toBe("#C0C0C0");
    expect(getValueColor("test", "dark")).toBe("#87CEEB");
    expect(getValueColor(100, "dark")).toBe("#FF6347");
  });

  it("should respect light mode", () => {
    expect(getValueColor(undefined, "light")).toBe("#808080");
    expect(getValueColor("test", "light")).toBe("#0000FF");
    expect(getValueColor(100, "light")).toBe("#FF0000");
  });
});

describe("useJsonTreeTheme", () => {
  it("should return dark theme when mode is dark", () => {
    (useTheme as jest.Mock).mockReturnValue({
      palette: {
        mode: "dark",
        text: { secondary: "#AAAAAA" },
      },
    });

    const theme = useJsonTreeTheme();

    expect(theme.base00).toBe("transparent");
    expect(theme.base0B).toBe("#87CEEB");
    expect(theme.base09).toBe("#FF6347");
    expect(theme.base07).toBe("#FFFFFF");
    expect(theme.base08).toBe("#C0C0C0");
    expect(theme.base0D).toBe("#90EE90");
    expect(theme.base03).toBe("#AAAAAA");
  });

  it("should return light theme when mode is light", () => {
    (useTheme as jest.Mock).mockReturnValue({
      palette: {
        mode: "light",
        text: { secondary: "#666666" },
      },
    });

    const theme = useJsonTreeTheme();

    expect(theme.base00).toBe("transparent");
    expect(theme.base0B).toBe("#0000FF");
    expect(theme.base09).toBe("#FF0000");
    expect(theme.base07).toBe("#000000");
    expect(theme.base08).toBe("#808080");
    expect(theme.base0D).toBe("#008000");
    expect(theme.base03).toBe("#666666");
  });
});
