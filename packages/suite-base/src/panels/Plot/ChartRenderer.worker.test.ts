/** @vitest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Chart } from "chart.js";

vi.mock("chart.js", async () => ({
  Chart: {
    register: vi.fn(),
  },
  Interaction: {
    modes: {},
  },
}));

describe("ChartJSManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register required Chart.js components", async () => {
    await import("@lichtblick/suite-base/components/Chart/worker/ChartJSManager");

    const registerSpy = vi.spyOn(Chart, "register");
    expect(registerSpy).toHaveBeenCalled();
  });
});
