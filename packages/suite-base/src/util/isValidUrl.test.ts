// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { isValidUrl } from "./isValidURL";

describe("isValidUrl", () => {
  it("should return true for valid URLs with allowed protocols", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
    expect(isValidUrl("file:///path/to/file")).toBe(true);
    expect(isValidUrl("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==")).toBe(true);
    expect(isValidUrl("package:example")).toBe(true);
  });

  it("should return false for URLs with disallowed protocols", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("mailto:someone@example.com")).toBe(false);
    expect(isValidUrl("javascript:alert('XSS')")).toBe(false);
  });

  it("should return false for invalid URL strings", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("://missing-protocol.com")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("should return false for undefined input", () => {
    expect(isValidUrl(undefined as unknown as string)).toBe(false);
  });
});
