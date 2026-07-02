// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** @vitest-environment jsdom */

import { Chart } from "chart.js";

vi.mock("chart.js", async () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: "CategoryScale",
  Filler: "Filler",
  Legend: "Legend",
  LinearScale: "LinearScale",
  LineController: "LineController",
  LineElement: "LineElement",
  PointElement: "PointElement",
  ScatterController: "ScatterController",
  TimeScale: "TimeScale",
  TimeSeriesScale: "TimeSeriesScale",
  Title: "Title",
  Tooltip: "Tooltip",
  Ticks: { formatters: {} },
  Interaction: {
    modes: {},
  },
}));

vi.mock("chartjs-plugin-annotation", async () => ({ default: "AnnotationPlugin" }));
vi.mock("@lichtblick/suite-base/panels/shared/loadFont", async () => ({
  loadDefaultFont: vi.fn(async () => {
    await Promise.resolve();
  }),
}));
vi.mock("@lichtblick/suite-base/util/Rpc", async () => ({ default: vi.fn() }));
vi.mock("@lichtblick/suite-base/util/RpcWorkerUtils", async () => ({
  setupWorker: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/components/Chart/worker/ChartJSManager", async () => ({
  default: vi.fn(),
}));

describe("ChartJSManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register required Chart.js components", async () => {
    await import("@lichtblick/suite-base/components/Chart/worker/ChartJsMux");

    expect(Chart.register).toHaveBeenCalled();
  });
});
