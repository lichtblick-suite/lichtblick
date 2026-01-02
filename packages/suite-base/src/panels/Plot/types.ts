// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Chart, ChartDataset, ScatterDataPoint } from "chart.js";
import { MutableRefObject } from "react";

import { Immutable } from "@lichtblick/suite";
import { PanelContextMenuItem } from "@lichtblick/suite-base/components/PanelContextMenu";
import { TimeBasedChartTooltipData } from "@lichtblick/suite-base/components/TimeBasedChart/TimeBasedChartTooltipContent";
import { OffscreenCanvasRenderer } from "@lichtblick/suite-base/panels/Plot/OffscreenCanvasRenderer";
import type { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import { CurrentCustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CurrentCustomDatasetsBuilder";
import { CustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CustomDatasetsBuilder";
import { IndexDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/IndexDatasetsBuilder";
import { TimestampDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/TimestampDatasetsBuilder";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { Bounds1D } from "@lichtblick/suite-base/types/Bounds";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { OriginalValue } from "./utils/datum";

export type Scale = {
  min: number;
  max: number;
  left: number;
  right: number;
};

export type BaseInteractionEvent = {
  cancelable: boolean;
  deltaY: number;
  deltaX: number;

  boundingClientRect: DOMRect;
};

export type MouseBase = BaseInteractionEvent & {
  clientX: number;
  clientY: number;
};

export type WheelInteractionEvent = { type: "wheel" } & BaseInteractionEvent & MouseBase;

export type PanStartInteractionEvent = { type: "panstart" } & BaseInteractionEvent & {
    center: { x: number; y: number };
  };
export type PanMoveInteractionEvent = { type: "panmove" } & BaseInteractionEvent;

export type PanEndInteractionEvent = { type: "panend" } & BaseInteractionEvent;

export type InteractionEvent =
  | WheelInteractionEvent
  | PanStartInteractionEvent
  | PanMoveInteractionEvent
  | PanEndInteractionEvent;

export type Datum = ScatterDataPoint & { value?: OriginalValue };

export type Dataset = ChartDataset<"scatter", Datum[]>;

export type ChartType = Chart<"scatter", Datum[]>;

export type HoverElement = {
  data: Datum;
  configIndex: number;
};

export type Size = { width: number; height: number };

export type ReferenceLine = { color: string; value: number };

export type UpdateAction = {
  type: "update";
  size?: { width: number; height: number };
  showXAxisLabels?: boolean;
  showYAxisLabels?: boolean;
  xBounds?: Partial<Bounds1D>;
  yBounds?: Partial<Bounds1D>;
  zoomMode?: "x" | "y" | "xy";
  referenceLines?: ReferenceLine[];
  interactionEvents?: InteractionEvent[];
};

// allows us to override the chart.ctx instance field which zoom plugin uses for adding event listeners
export type MutableContext<T> = Omit<Chart, "ctx"> & { ctx: T };

export type PanEvent = {
  deltaX: number;
  deltaY: number;
};

export type PanStartEvent = PanEvent & {
  center: { x: number; y: number };
  target: {
    getBoundingClientRect(): DOMRect;
  };
};

export type ZoomableChart = Chart & {
  $zoom: {
    panStartHandler(event: PanStartEvent): void;
    panHandler(event: PanEvent): void;
    panEndHandler(): void;
  };
};

export type PlotProps = {
  config: PlotConfig;
  saveConfig: SaveConfig<PlotConfig>;
};

export type ElementAtPixelArgs = {
  clientX: number;
  clientY: number;
  canvasX: number;
  canvasY: number;
};

export type UseHoverHandlersHook = {
  onMouseMove: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseOut: () => void;
  onWheel: (event: React.WheelEvent<HTMLElement>) => void;
  onResetView: () => void;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  onClickPath: (index: number) => void;
  focusedPath: string[] | undefined;
  keyDownHandlers: {
    v: () => void;
    b: () => void;
  };
  keyUphandlers: {
    v: () => void;
    b: () => void;
  };
  getPanelContextMenuItems: () => PanelContextMenuItem[];
};

export type TooltipStateSetter = {
  x: number;
  y: number;
  data: TimeBasedChartTooltipData[];
};

export type ChartRendererProps = {
  canvas: OffscreenCanvas;
  devicePixelRatio: number;
  gridColor: string;
  tickColor: string;
};

export type ChartOptionsPlot = Omit<ChartRendererProps, "canvas">;

export type VerticalBarsProps = {
  coordinator?: PlotCoordinator;
  hoverComponentId: string;
  xAxisIsPlaybackTime: boolean;
};

export type UsePlotDataHandling = {
  colorsByDatasetIndex: Record<string, string>;
  labelsByDatasetIndex: Record<string, string>;
  datasetsBuilder:
    | TimestampDatasetsBuilder
    | IndexDatasetsBuilder
    | CustomDatasetsBuilder
    | CurrentCustomDatasetsBuilder;
};

export type UsePlotInteractionHandlersProps = {
  config: PlotConfig;
  coordinator: PlotCoordinator | undefined;
  draggingRef: MutableRefObject<boolean>;
  renderer: OffscreenCanvasRenderer | undefined;
  setActiveTooltip: (data: TooltipStateSetter | undefined) => void;
  shouldSync: boolean;
  subscriberId: string;
};

export type PlotCoordinatorEventTypes = {
  timeseriesBounds(bounds: Immutable<Bounds1D>): void;

  /** X scale changed. */
  xScaleChanged(scale: Scale | undefined): void;

  /** Current values changed (for displaying in the legend) */
  currentValuesChanged(values: readonly unknown[]): void;

  /** Paths with mismatched data lengths were detected */
  pathsWithMismatchedDataLengthsChanged(pathsWithMismatchedDataLengths: string[]): void;

  /** Rendering updated the viewport. `canReset` is true if the viewport can be reset. */
  viewportChange(canReset: boolean): void;
};

export type ConfigBounds = { x: Partial<Bounds1D>; y: Partial<Bounds1D> };
