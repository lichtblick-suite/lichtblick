/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { CurrentCustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CurrentCustomDatasetsBuilder";
import { CustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CustomDatasetsBuilder";
import { TimestampDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/TimestampDatasetsBuilder";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import usePlotDataHandling from "./usePlotDataHandling";
import { IndexDatasetsBuilder } from "../builders/IndexDatasetsBuilder";

jest.mock("@lichtblick/message-path", () => ({
  parseMessagePath: jest.fn(),
}));

jest.mock(
  "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems",
  () => ({
    fillInGlobalVariablesInPath: jest.fn(),
  }),
);

jest.mock("@lichtblick/suite-base/util/plotColors", () => ({
  getLineColor: jest.fn(
    (color: string | undefined, idx: number) => color ?? `default-color-${idx}`,
  ),
}));

global.Worker = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  onmessage: undefined,
  postMessage: jest.fn(),
  terminate: jest.fn(),
}));

describe("usePlotDataHandling hook", () => {
  const globalVariables: GlobalVariables = {};

  it("should create an IndexDatasetsBuilder for 'index' xAxisVal", () => {
    const config = PlotBuilder.config({
      xAxisVal: "index",
    });

    const { result } = renderHook(() => usePlotDataHandling(config, globalVariables));

    expect(result.current.datasetsBuilder).toBeInstanceOf(IndexDatasetsBuilder);
  });

  it("should create a TimestampDatasetsBuilder for 'timestamp' xAxisVal", () => {
    const config = PlotBuilder.config({
      xAxisVal: "timestamp",
    });

    const { result } = renderHook(() => usePlotDataHandling(config, globalVariables));

    expect(result.current.datasetsBuilder).toBeInstanceOf(TimestampDatasetsBuilder);
  });

  it("should create a CurrentCustomDatasetsBuilder for 'currentCustom' xAxisVal", () => {
    const config = PlotBuilder.config({
      xAxisVal: "currentCustom",
    });

    const { result } = renderHook(() => usePlotDataHandling(config, globalVariables));

    expect(result.current.datasetsBuilder).toBeInstanceOf(CurrentCustomDatasetsBuilder);
  });

  it("should create a CustomDatasetsBuilder for 'custom' xAxisVal", () => {
    const config = PlotBuilder.config({
      xAxisVal: "custom",
    });

    const { result } = renderHook(() => usePlotDataHandling(config, globalVariables));

    expect(result.current.datasetsBuilder).toBeInstanceOf(CustomDatasetsBuilder);
  });

  it("should handle empty xAxisPath gracefully for 'currentCustom' xAxisVal", () => {
    const config = PlotBuilder.config({
      xAxisVal: "currentCustom",
      xAxisPath: { value: "", enabled: true },
    });

    const { result } = renderHook(() => usePlotDataHandling(config, globalVariables));

    expect(result.current.datasetsBuilder).toBeInstanceOf(CurrentCustomDatasetsBuilder);
  });

  it("should handle missing xAxisPath gracefully for 'custom' xAxisVal", () => {
    const config = PlotBuilder.config({
      xAxisVal: "custom",
      xAxisPath: undefined,
    });

    const { result } = renderHook(() => usePlotDataHandling(config, globalVariables));

    expect(result.current.datasetsBuilder).toBeInstanceOf(CustomDatasetsBuilder);
  });

  it("should throw error when xAxisPath is unsupported", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const config = PlotBuilder.config({
      xAxisVal: "unsupportedMode" as any,
      xAxisPath: undefined,
    });

    expect(() => renderHook(() => usePlotDataHandling(config, globalVariables))).toThrow(
      `unsupported mode: ${config.xAxisVal}`,
    );
    consoleErrorSpy.mockRestore();
  });

  it("should generate correct colors and labels for datasets", () => {
    const config = PlotBuilder.config({
      paths: [
        PlotBuilder.path({
          color: BasicBuilder.string(),
          enabled: true,
          label: BasicBuilder.string(),
          timestampMethod: "receiveTime",
        }),
        PlotBuilder.path({
          color: BasicBuilder.string(),
          enabled: true,
          label: BasicBuilder.string(),
          timestampMethod: "receiveTime",
        }),
      ],
    });

    const { result } = renderHook(() => usePlotDataHandling(config, globalVariables));

    expect(result.current.colorsByDatasetIndex).toEqual({
      0: config.paths[0]?.color,
      1: config.paths[1]?.color,
    });
    expect(result.current.labelsByDatasetIndex).toEqual({
      0: config.paths[0]?.label,
      1: config.paths[1]?.label,
    });
  });
});
