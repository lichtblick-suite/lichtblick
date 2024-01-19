// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { debouncePromise } from "@foxglove/den/async";
import { filterMap } from "@foxglove/den/collection";
import { toSec, subtract as subtractTime } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import { RosPath } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { stringifyRosPath } from "@foxglove/studio-base/components/MessagePathSyntax/stringifyRosPath";
import { fillInGlobalVariablesInPath } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { Bounds1D } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PlayerState } from "@foxglove/studio-base/players/types";
import { Bounds } from "@foxglove/studio-base/types/Bounds";
import { getContrastColor, getLineColor } from "@foxglove/studio-base/util/plotColors";

import { InteractionEvent, Scale, UpdateAction } from "./ChartRenderer";
import { OffscreenCanvasRenderer } from "./OffscreenCanvasRenderer";
import {
  CsvDataset,
  IDatasetsBuilder,
  SeriesConfigKey,
  SeriesItem,
  Viewport,
} from "./builders/IDatasetsBuilder";
import { isReferenceLinePlotPathType, PlotConfig } from "./config";

type EventTypes = {
  timeseriesBounds(bounds: Immutable<Bounds1D>): void;

  /** X scale changed. */
  xScaleChanged(scale: Scale | undefined): void;

  /** Current values changed (for displaying in the legend) */
  currentValuesChanged(values: readonly unknown[]): void;

  /** Paths with mismatched data lengths were detected */
  pathsWithMismatchedDataLengthsChanged(pathsWithMismatchedDataLengths: string[]): void;
};

/**
 * PlotCoordinator interfaces commands and updates between the dataset builder and the chart
 * renderer.
 */
export class PlotCoordinator extends EventEmitter<EventTypes> {
  #renderer: OffscreenCanvasRenderer;
  #datasetsBuilder: IDatasetsBuilder;

  #configBounds: { x: Partial<Bounds1D>; y: Partial<Bounds1D> } = {
    x: {},
    y: {},
  };

  #globalBounds?: Immutable<Partial<Bounds1D>>;
  #datasetRange?: Bounds1D;
  #followRange?: number;
  #interactionBounds?: Bounds;

  #lastSeekTime = NaN;

  /** Current value for each series to show in the legend */
  #currentValues: unknown[] = [];
  /** Path with variables filled in for each series */
  #seriesPaths: (RosPath | undefined)[] = [];

  /** Flag indicating that new Y bounds should be sent to the renderer because the bounds have been reset */
  #shouldResetY = false;

  #updateAction: UpdateAction = { type: "update" };

  #isTimeseriesPlot: boolean = false;
  #currentSeconds?: number;

  #viewport: Viewport = {
    size: { width: 0, height: 0 },
    bounds: { x: undefined, y: undefined },
  };

  #latestXScale?: Scale;

  #queueDispatchRender = debouncePromise(async () => {
    await this.#dispatchRender();
  });

  #queueDispatchDatasets = debouncePromise(async () => {
    await this.#dispatchDatasets();
  });

  #destroyed = false;

  public constructor(renderer: OffscreenCanvasRenderer, builder: IDatasetsBuilder) {
    super();

    this.#renderer = renderer;
    this.#datasetsBuilder = builder;
  }

  /** Stop the coordinator from sending any future updates to the renderer. */
  public destroy(): void {
    this.#destroyed = true;
  }

  public handlePlayerState(state: Immutable<PlayerState>): void {
    if (this.#destroyed) {
      return;
    }
    const activeData = state.activeData;
    if (!activeData) {
      return;
    }

    const { messages, lastSeekTime, currentTime, startTime } = activeData;

    if (this.#isTimeseriesPlot) {
      const secondsSinceStart = toSec(subtractTime(currentTime, startTime));
      this.#currentSeconds = secondsSinceStart;
    }

    const datasetsRange = this.#datasetsBuilder.handlePlayerState(state);

    if (lastSeekTime !== this.#lastSeekTime) {
      this.#currentValues = [];
      this.#lastSeekTime = lastSeekTime;
    }

    this.#seriesPaths.forEach((path, idx) => {
      if (!path) {
        return;
      }
      for (let i = messages.length - 1; i >= 0; --i) {
        const msgEvent = messages[i]!;
        if (msgEvent.topic !== path.topicName) {
          continue;
        }
        const items = simpleGetMessagePathDataItems(msgEvent, path);
        if (items.length > 0) {
          this.#currentValues[idx] = items[items.length - 1];
          break;
        }
      }
    });

    this.emit("currentValuesChanged", this.#currentValues);

    this.#datasetRange = datasetsRange;
    this.#queueDispatchRender();
  }

  public handleConfig(
    config: Immutable<PlotConfig>,
    colorScheme: "light" | "dark",
    globalVariables: GlobalVariables,
  ): void {
    if (this.#destroyed) {
      return;
    }
    this.#isTimeseriesPlot = config.xAxisVal === "timestamp";
    if (!this.#isTimeseriesPlot) {
      this.#currentSeconds = undefined;
    }
    this.#followRange = config.followingViewWidth;

    const newConfigBounds = {
      x: {
        max: config.maxXValue,
        min: config.minXValue,
      },
      y: {
        max: config.maxYValue == undefined ? undefined : +config.maxYValue,
        min: config.minYValue == undefined ? undefined : +config.minYValue,
      },
    };
    const configYBoundsChanged =
      this.#configBounds.y.min !== newConfigBounds.y.min ||
      this.#configBounds.y.max !== newConfigBounds.y.max;
    this.#configBounds = newConfigBounds;

    const referenceLines = filterMap(config.paths, (path, idx) => {
      if (!path.enabled || !isReferenceLinePlotPathType(path)) {
        return;
      }

      const value = +path.value;
      if (isNaN(value)) {
        return;
      }

      return {
        color: getLineColor(path.color, idx),
        value,
      };
    });

    this.#seriesPaths = config.paths.map((path) => {
      if (path.timestampMethod === "headerStamp") {
        // We currently do not support showing current values in the legend for header.stamp mode
        return undefined;
      }
      if (isReferenceLinePlotPathType(path)) {
        return undefined;
      }
      const parsed = parseRosPath(path.value);
      if (!parsed) {
        return undefined;
      }

      return fillInGlobalVariablesInPath(parsed, globalVariables);
    });
    this.#currentValues = [];
    this.emit("currentValuesChanged", this.#currentValues);

    this.#updateAction.showXAxisLabels = config.showXAxisLabels;
    this.#updateAction.showYAxisLabels = config.showYAxisLabels;
    this.#updateAction.referenceLines = referenceLines;

    if (configYBoundsChanged) {
      // Config changes to yBounds always takes precedence over user interaction changes like pan/zoom
      this.#updateAction.yBounds = this.#configBounds.y;
    }

    const seriesItems = filterMap(config.paths, (path, idx): Immutable<SeriesItem> | undefined => {
      if (isReferenceLinePlotPathType(path)) {
        return;
      }

      const parsed = parseRosPath(path.value);
      if (!parsed) {
        return;
      }

      const filledParsed = fillInGlobalVariablesInPath(parsed, globalVariables);

      // When global variables change the path.value is still the original value with the variable
      // names But we need to consider this as a new series (new block cursor) so we compute new
      // values when variables cause the resolved path value to update.
      //
      // We also want to re-compute values when the timestamp method changes. So we use a _key_ that
      // is the filled path and the timestamp method. If either change, we consider this a new
      // series.
      //
      // This key lets us treat series with the same name but different timestamp methods as distinct
      // using a key instead of the path index lets us preserve loaded data when a path is removed
      const key = `${path.timestampMethod}:${stringifyRosPath(filledParsed)}` as SeriesConfigKey;

      const color = getLineColor(path.color, idx);
      return {
        key,
        messagePath: path.value,
        parsed: filledParsed,
        color,
        contrastColor: getContrastColor(colorScheme, color),
        lineSize: path.lineSize ?? 1.0,
        timestampMethod: path.timestampMethod,
        showLine: path.showLine ?? true,
        enabled: path.enabled,
      };
    });

    this.#datasetsBuilder.setSeries(seriesItems);
    this.#queueDispatchRender();
  }

  public setGlobalBounds(bounds: Immutable<Bounds1D> | undefined): void {
    this.#globalBounds = bounds;
    this.#interactionBounds = undefined;
    if (bounds == undefined) {
      // This happens when "reset view" is clicked in a different panel or otherwise cleared the global bounds
      this.#shouldResetY = true;
    }
    this.#queueDispatchRender();
  }

  public setZoomMode(mode: "x" | "xy" | "y"): void {
    this.#updateAction.zoomMode = mode;
    this.#queueDispatchRender();
  }

  public resetBounds(): void {
    this.#interactionBounds = undefined;
    this.#globalBounds = undefined;
    this.#shouldResetY = true;
    this.#queueDispatchRender();
  }

  public setSize(size: { width: number; height: number }): void {
    this.#viewport.size = size;
    this.#updateAction.size = size;
    this.#queueDispatchRender();
  }

  public addInteractionEvent(ev: InteractionEvent): void {
    if (!this.#updateAction.interactionEvents) {
      this.#updateAction.interactionEvents = [];
    }
    this.#updateAction.interactionEvents.push(ev);
    this.#queueDispatchRender();
  }

  /** Get the plot x value at the canvas pixel x location */
  public getXValueAtPixel(pixelX: number): number {
    if (!this.#latestXScale) {
      return -1;
    }

    const pixelRange = this.#latestXScale.right - this.#latestXScale.left;
    if (pixelRange <= 0) {
      return -1;
    }

    // Linear interpolation to place the pixelX value within min/max
    return (
      this.#latestXScale.min +
      ((pixelX - this.#latestXScale.left) / pixelRange) *
        (this.#latestXScale.max - this.#latestXScale.min)
    );
  }

  /** Get the entire data for all series */
  public async getCsvData(): Promise<CsvDataset[]> {
    if (this.#destroyed) {
      return [];
    }
    return await this.#datasetsBuilder.getCsvData();
  }

  #getXBounds(): Partial<Bounds1D> {
    // Interaction, synced global bounds, config, and other bounds sources are combined in precedence order.
    // currentSeconds is only included in the sequence if follow mode is enabled.

    const currentSecondsIfFollowMode =
      this.#isTimeseriesPlot && this.#followRange != undefined && this.#currentSeconds != undefined
        ? this.#currentSeconds
        : undefined;
    const xMax =
      this.#interactionBounds?.x.max ??
      this.#globalBounds?.max ??
      currentSecondsIfFollowMode ??
      this.#configBounds.x.max ??
      this.#datasetRange?.max;

    const xMinIfFollowMode =
      this.#isTimeseriesPlot && this.#followRange != undefined && xMax != undefined
        ? xMax - this.#followRange
        : undefined;
    const xMin =
      this.#interactionBounds?.x.min ??
      this.#globalBounds?.min ??
      xMinIfFollowMode ??
      this.#configBounds.x.min ??
      this.#datasetRange?.min;

    return { min: xMin, max: xMax };
  }

  async #dispatchRender(): Promise<void> {
    if (this.#destroyed) {
      return;
    }
    this.#updateAction.xBounds = this.#getXBounds();

    if (this.#shouldResetY) {
      const yMin = this.#interactionBounds?.y.min ?? this.#configBounds.y.min;
      const yMax = this.#interactionBounds?.y.max ?? this.#configBounds.y.max;
      this.#updateAction.yBounds = { min: yMin, max: yMax };
      this.#shouldResetY = false;
    }

    const haveInteractionEvents = (this.#updateAction.interactionEvents?.length ?? 0) > 0;

    const action = this.#updateAction;
    this.#updateAction = {
      type: "update",
    };

    const bounds = await this.#renderer.update(action);

    if (haveInteractionEvents) {
      this.#interactionBounds = bounds;
    }

    if (haveInteractionEvents && bounds) {
      this.emit("timeseriesBounds", bounds.x);
    }
    this.#queueDispatchDatasets();
  }

  async #dispatchDatasets(): Promise<void> {
    if (this.#destroyed) {
      return;
    }
    this.#viewport.bounds.x = this.#getXBounds();
    this.#viewport.bounds.y = this.#interactionBounds?.y ?? this.#configBounds.y;

    const result = await this.#datasetsBuilder.getViewportDatasets(this.#viewport);
    this.#latestXScale = await this.#renderer.updateDatasets(result.datasets);
    this.emit("xScaleChanged", this.#latestXScale);
    this.emit("pathsWithMismatchedDataLengthsChanged", [...result.pathsWithMismatchedDataLengths]);
  }
}
