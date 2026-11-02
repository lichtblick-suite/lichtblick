// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getOpenStreetMapHeaders } from "./getOpenStreetMapHeaders";

const app = {
  name: "Lichtblick",
  version: "1.29.1",
  homepage: "https://github.com/lichtblick-suite",
};

describe("getOpenStreetMapHeaders", () => {
  it.each([
    "User-Agent",
    "user-agent",
    "USER-AGENT",
  ])("replaces %s while preserving caching and referrer headers", (header) => {
    const headers = {
      [header]: "Mozilla/5.0 Chrome/144.0.0.0 Electron/44.0.0",
      "If-None-Match": '"tile-etag"',
      Referer: "http://localhost:8080/",
    };
    expect(getOpenStreetMapHeaders(headers, app)).toEqual({
      "User-Agent": "Lichtblick/1.29.1 (+https://github.com/lichtblick-suite)",
      "If-None-Match": '"tile-etag"',
      Referer: "http://localhost:8080/",
    });
    expect(headers[header]).toContain("Mozilla");
  });

  it("identifies native requests without inventing a referrer", () => {
    expect(getOpenStreetMapHeaders({}, app)).toEqual({
      "User-Agent": "Lichtblick/1.29.1 (+https://github.com/lichtblick-suite)",
    });
  });
});
