// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DesktopLayoutLoader } from "./DesktopLayoutLoader";
import { Desktop } from "../../common/types";

describe("DesktopLayoutLoader", () => {
  const mockBridge = {
    fetchLayouts: jest.fn(),
  } as unknown as jest.Mocked<Desktop>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return correct layouts", async () => {
    mockBridge.fetchLayouts.mockResolvedValueOnce([
      { from: "layout1.json", layoutJson: { some: "data" } },
      { from: "layout2.json", layoutJson: { other: "data" } },
    ]);

    const loader = new DesktopLayoutLoader(mockBridge);
    const result = await loader.fetchLayouts();

    expect(result).toEqual([
      {
        from: "layout1.json",
        name: "layout1",
        data: { some: "data" },
      },
      {
        from: "layout2.json",
        name: "layout2",
        data: { other: "data" },
      },
    ]);
  });

  it("should return an empty array if no layouts are found", async () => {
    mockBridge.fetchLayouts.mockResolvedValueOnce([]);

    const loader = new DesktopLayoutLoader(mockBridge);
    const result = await loader.fetchLayouts();

    expect(result).toEqual([]);
  });
});
