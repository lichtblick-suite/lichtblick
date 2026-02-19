/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { loadDefaultFont } from "./loadFont";

jest.mock("@lichtblick/suite-base/styles/assets/PlexMono.woff2", () => "mock-font.woff2");

describe("loadDefaultFont", () => {
  let mockFontFace: jest.Mock;

  beforeEach(() => {
    mockFontFace = jest.fn().mockImplementation((family) => ({
      load: jest.fn().mockResolvedValue({ family }),
    }));

    (global as any).FontFace = mockFontFace;

    Object.defineProperty(document, "fonts", {
      value: { add: jest.fn() },
    });

    global.WorkerGlobalScope = undefined as any;
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should load and add the font to document.fonts if not in a worker", async () => {
    const family = "IBM Plex Mono";

    const font = await loadDefaultFont();

    expect(global.fetch).toHaveBeenCalledWith("mock-font.woff2");
    expect(mockFontFace).toHaveBeenCalledWith(family, expect.any(ArrayBuffer));
    expect(font).toEqual({ family });
  });
});
