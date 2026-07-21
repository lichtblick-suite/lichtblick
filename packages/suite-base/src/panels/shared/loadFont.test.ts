/** @vitest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { loadDefaultFont } from "./loadFont";

vi.mock("@lichtblick/suite-base/styles/assets/PlexMono.woff2", () => ({ default: "mock-font.woff2" }));

describe("loadDefaultFont", () => {
  let mockFontFace: Mock;

  beforeEach(() => {
    mockFontFace = vi.fn().mockImplementation((family) => ({
      load: vi.fn().mockResolvedValue({ family }),
    }));

    (global as any).FontFace = mockFontFace;

    Object.defineProperty(document, "fonts", {
      value: { add: vi.fn() },
    });

    global.WorkerGlobalScope = undefined as any;
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should load and add the font to document.fonts if not in a worker", async () => {
    const family = "IBM Plex Mono";

    const font = await loadDefaultFont();

    expect(global.fetch).toHaveBeenCalledWith("mock-font.woff2");
    expect(mockFontFace).toHaveBeenCalledWith(family, expect.any(ArrayBuffer));
    expect(font).toEqual({ family });
  });
});
