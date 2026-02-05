/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { userEvent } from "@storybook/testing-library";
import { act, fireEvent, render, screen } from "@testing-library/react";

import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { DEFAULT_PLOT_CONFIG } from "@lichtblick/suite-base/panels/Plot/constants";
import useGlobalSync from "@lichtblick/suite-base/panels/Plot/hooks/useGlobalSync";
import usePanning from "@lichtblick/suite-base/panels/Plot/hooks/usePanning";
import usePlotDataHandling from "@lichtblick/suite-base/panels/Plot/hooks/usePlotDataHandling";
import usePlotPanelSettings from "@lichtblick/suite-base/panels/Plot/hooks/usePlotPanelSettings";
import useRenderer from "@lichtblick/suite-base/panels/Plot/hooks/useRenderer";
import useSubscriptions from "@lichtblick/suite-base/panels/Plot/hooks/useSubscriptions";
import { PlotProps } from "@lichtblick/suite-base/panels/Plot/types";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import Plot from "./Plot";

const mockSetMessagePathDropConfig = jest.fn();
jest.mock("@lichtblick/suite-base/components/PanelContext", () => ({
  usePanelContext: () => ({ setMessagePathDropConfig: mockSetMessagePathDropConfig }),
}));

const mockGetMessagePipelineState = jest.fn();
const mockSubscribeMessagePipeline = jest.fn();
jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineGetter: () => mockGetMessagePipelineState,
  useMessagePipelineSubscribe: () => mockSubscribeMessagePipeline,
}));

jest.mock("@lichtblick/suite-base/components/PanelContextMenu", () => ({
  PanelContextMenu: jest.fn(() => <div data-testid="panel-context-menu" />),
}));
jest.mock("@lichtblick/suite-base/components/PanelToolbar", () => ({
  __esModule: true,
  default: () => <div data-testid="panel-toolbar" />,
}));

let mockLatestLegendProps: any;
jest.mock("@lichtblick/suite-base/panels/Plot/PlotLegend", () => ({
  PlotLegend: jest.fn((props) => {
    mockLatestLegendProps = props;
    return <div data-testid="plot-legend" />;
  }),
}));

jest.mock("@lichtblick/suite-base/panels/Plot/VerticalBars", () => ({
  VerticalBars: jest.fn(() => <div data-testid="vertical-bars" />),
}));

jest.mock("@lichtblick/suite-base/hooks/useGlobalVariables");
jest.mock("@lichtblick/suite-base/panels/Plot/hooks/usePlotDataHandling");
jest.mock("@lichtblick/suite-base/panels/Plot/hooks/useRenderer");
jest.mock("@lichtblick/suite-base/panels/Plot/hooks/useGlobalSync");
jest.mock("@lichtblick/suite-base/panels/Plot/hooks/usePanning");
jest.mock("@lichtblick/suite-base/panels/Plot/hooks/useSubscriptions");
jest.mock("@lichtblick/suite-base/panels/Plot/hooks/usePlotPanelSettings");
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

let mockLatestSetActiveTooltip: ((data: any) => void) | undefined;
const mockInteractionHandlers = {
  onMouseMove: jest.fn(),
  onMouseOut: jest.fn(),
  onResetView: jest.fn(),
  onWheel: jest.fn(),
  onClick: jest.fn(),
  onClickPath: jest.fn(),
  focusedPath: undefined,
  keyDownHandlers: { v: jest.fn(), b: jest.fn() },
  keyUphandlers: { v: jest.fn(), b: jest.fn() },
  getPanelContextMenuItems: jest.fn(() => []),
};

jest.mock("./hooks/usePlotInteractionHandlers", () => ({
  __esModule: true,
  default: jest.fn((args) => {
    mockLatestSetActiveTooltip = args.setActiveTooltip;
    return mockInteractionHandlers;
  }),
}));

let mockCoordinatorInstance: any;
const mockPlotCoordinatorCtor = jest.fn();
jest.mock("./PlotCoordinator", () => ({
  PlotCoordinator: jest.fn((renderer, builder) => mockPlotCoordinatorCtor(renderer, builder)),
}));

const rendererStub = { id: "renderer" } as any;
const datasetsBuilderStub = { id: "datasets-builder" } as any;
let mockSetCanReset: (({ canReset }: { canReset: boolean }) => void) | undefined;

class PlotConfigBuilder {
  private config = { ...DEFAULT_PLOT_CONFIG, paths: [...DEFAULT_PLOT_CONFIG.paths] };

  public withPaths(paths: PlotConfig["paths"]): this {
    this.config = { ...this.config, paths };
    return this;
  }

  public withLegendDisplay(legendDisplay: PlotConfig["legendDisplay"]): this {
    this.config = { ...this.config, legendDisplay };
    return this;
  }

  public withShowPlotValues(): this {
    this.config = { ...this.config, showPlotValuesInLegend: true };
    return this;
  }

  public build(): PlotConfig {
    return { ...this.config, paths: [...this.config.paths] };
  }
}

describe("Plot Component", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockCoordinatorInstance = {
      handleConfig: jest.fn(),
      handlePlayerState: jest.fn(),
      setShouldSync: jest.fn(),
      setSize: jest.fn(),
      destroy: jest.fn(),
      resetBounds: jest.fn(),
      setZoomMode: jest.fn(),
      getXValueAtPixel: jest.fn(),
    };
    mockPlotCoordinatorCtor.mockImplementation(() => mockCoordinatorInstance);
    (usePlotDataHandling as jest.Mock).mockReturnValue({
      colorsByDatasetIndex: { 0: "red", 1: "blue" },
      labelsByDatasetIndex: { 0: "first", 1: "second" },
      datasetsBuilder: datasetsBuilderStub,
    });
    (useRenderer as jest.Mock).mockReturnValue(rendererStub);
    (useGlobalVariables as jest.Mock).mockReturnValue({
      globalVariables: {},
      setGlobalVariables: jest.fn(),
    });
    (useGlobalSync as jest.Mock).mockImplementation((_coord, setCanReset) => {
      mockSetCanReset = setCanReset;
    });
    (usePanning as jest.Mock).mockReturnValue(undefined);
    (useSubscriptions as jest.Mock).mockReturnValue(undefined);
    (usePlotPanelSettings as jest.Mock).mockReturnValue(undefined);
    mockLatestSetActiveTooltip = undefined;
    mockLatestLegendProps = undefined;
    Object.values(mockInteractionHandlers).forEach((handler) => {
      if (typeof handler === "function") {
        handler.mockClear();
      }
    });
    mockSetMessagePathDropConfig.mockReset();
    mockGetMessagePipelineState.mockReset();
    mockSubscribeMessagePipeline.mockReset();
    mockSetCanReset = undefined;
    mockGetMessagePipelineState.mockReturnValue({ playerState: { source: "getter" } });
    mockSubscribeMessagePipeline.mockImplementation((callback) => {
      callback({ playerState: { source: "subscriber" } });
      return jest.fn();
    });
    (globalThis as any).ResizeObserver = class {
      public disconnect = jest.fn();
      public observe = jest.fn();
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const defaultBoundingRect = {
    width: 640,
    height: 360,
    top: 0,
    left: 0,
    bottom: 360,
    right: 640,
    x: 0,
    y: 0,
    toJSON: () => ({}) as any,
  } as DOMRect;

  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(defaultBoundingRect);

  function renderPlot(config: PlotConfig, saveConfig: jest.Mock = jest.fn()) {
    const props: PlotProps = { config, saveConfig };
    const ui = (
      <ThemeProvider isDark>
        <Plot {...props} />
      </ThemeProvider>
    );

    return { ...render(ui), saveConfig, user: userEvent.setup() };
  }

  it("Given hovered tooltip When values arrive Then legend shows hovered values", async () => {
    // Given
    const config = new PlotConfigBuilder()
      .withPaths([
        { value: "/topic1", enabled: true, timestampMethod: "receiveTime" },
        { value: "/topic2", enabled: true, timestampMethod: "receiveTime" },
      ])
      .withShowPlotValues()
      .build();

    renderPlot(config);

    // When
    await act(async () => {
      mockLatestSetActiveTooltip?.({
        x: 10,
        y: 10,
        data: [
          { configIndex: 0, value: 5 },
          { configIndex: 1, value: 10 },
        ],
      });
    });

    // Then
    expect(mockLatestLegendProps?.hoveredValuesBySeriesIndex).toEqual([5, 10]);
    expect(mockLatestLegendProps?.showValues).toBe(true);
  });

  it("Given legendDisplay none When rendering Then legend is hidden", () => {
    // Given
    const config = new PlotConfigBuilder().withLegendDisplay("none").build();

    // When
    renderPlot(config);

    // Then
    expect(screen.queryByTestId("plot-legend")).toBeNull();
  });

  it("Given reset allowed When clicking reset button Then onResetView is called", async () => {
    // Given
    const config = new PlotConfigBuilder().build();
    renderPlot(config);
    act(() => mockSetCanReset?.({ canReset: true }));

    const resetButton = await screen.findByText("resetView");

    // When
    await userEvent.click(resetButton);

    // Then
    expect(mockInteractionHandlers.onResetView).toHaveBeenCalled();
  });

  it("Given canvas interactions When user moves, clicks, scrolls Then delegate handlers fire", async () => {
    // Given
    const config = new PlotConfigBuilder()
      .withPaths([{ value: "/topic", enabled: true, timestampMethod: "receiveTime" }])
      .build();
    renderPlot(config);
    const canvas = screen.getByTestId("vertical-bar-wrapper").firstElementChild as HTMLElement;

    // When
    fireEvent.mouseMove(canvas);
    fireEvent.mouseOut(canvas);
    fireEvent.wheel(canvas);
    fireEvent.click(canvas);
    fireEvent.doubleClick(canvas);

    // Then
    expect(mockInteractionHandlers.onMouseMove).toHaveBeenCalled();
    expect(mockInteractionHandlers.onMouseOut).toHaveBeenCalled();
    expect(mockInteractionHandlers.onWheel).toHaveBeenCalled();
    expect(mockInteractionHandlers.onClick).toHaveBeenCalled();
    expect(mockInteractionHandlers.onResetView).toHaveBeenCalled();
  });

  it("Given drop config When handleDrop invoked Then saveConfig receives new paths", () => {
    // Given
    const saveConfig = jest.fn();
    const config = new PlotConfigBuilder().build();
    renderPlot(config, saveConfig);
    const dropConfig = mockSetMessagePathDropConfig.mock.calls[0][0];

    // When
    const status = dropConfig.getDropStatus([{ isLeaf: false }]);
    const addStatus = dropConfig.getDropStatus([{ isLeaf: true }]);
    dropConfig.handleDrop([{ path: "/new", isLeaf: true }]);

    // Then
    expect(status).toEqual({ canDrop: false });
    expect(addStatus).toEqual({ canDrop: true, effect: "add" });
    const updater = saveConfig.mock.calls[0][0];
    const updatedConfig = updater(config);
    expect(updatedConfig.paths).toEqual([
      ...config.paths,
      { value: "/new", enabled: true, timestampMethod: "receiveTime" },
    ]);
  });

  it("Given renderer present When mounted Then coordinator lifecycle hooks are exercised", () => {
    // Given
    const config = new PlotConfigBuilder()
      .withPaths([{ value: "/topic", enabled: true, timestampMethod: "receiveTime" }])
      .build();

    const { unmount } = renderPlot(config);

    // When
    unmount();

    // Then
    expect(mockPlotCoordinatorCtor).toHaveBeenCalledWith(rendererStub, datasetsBuilderStub);
    expect(mockCoordinatorInstance.setSize).toHaveBeenCalledWith({
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(mockCoordinatorInstance.handleConfig).toHaveBeenCalledWith(
      config,
      expect.any(String),
      {},
    );
    expect(mockCoordinatorInstance.handlePlayerState).toHaveBeenCalledWith({
      source: "subscriber",
    });
    expect(mockCoordinatorInstance.handlePlayerState).toHaveBeenCalledWith({ source: "getter" });
    expect(mockCoordinatorInstance.setShouldSync).toHaveBeenCalledWith({ shouldSync: true });
    expect(mockCoordinatorInstance.destroy).toHaveBeenCalled();
  });
});
