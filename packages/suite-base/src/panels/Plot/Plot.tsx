// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseMessagePath } from "@foxglove/message-path";
import { Button, Tooltip, Fade, buttonClasses, useTheme } from "@mui/material";
import Hammer from "hammerjs";
import * as _ from "lodash-es";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMountedState } from "react-use";
import { makeStyles } from "tss-react/mui";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@lichtblick/den/async";
import { filterMap } from "@lichtblick/den/collection";
import { add as addTimes, fromSec, isTime, toSec } from "@lichtblick/rostime";
import { Immutable } from "@lichtblick/suite";
import KeyListener from "@lichtblick/suite-base/components/KeyListener";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
  useMessagePipelineSubscribe,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import {
  PanelContextMenu,
  PanelContextMenuItem,
} from "@lichtblick/suite-base/components/PanelContextMenu";
import PanelToolbar, {
  PANEL_TOOLBAR_MIN_HEIGHT,
} from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import TimeBasedChartTooltipContent, {
  TimeBasedChartTooltipData,
} from "@lichtblick/suite-base/components/TimeBasedChart/TimeBasedChartTooltipContent";
import { Bounds1D } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import {
  TimelineInteractionStateStore,
  useClearHoverValue,
  useSetHoverValue,
  useTimelineInteractionState,
} from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { VerticalBars } from "@lichtblick/suite-base/panels/Plot/VerticalBars";
import { SubscribePayload } from "@lichtblick/suite-base/players/types";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { PANEL_TITLE_CONFIG_KEY } from "@lichtblick/suite-base/util/layout";
import { getLineColor } from "@lichtblick/suite-base/util/plotColors";

import { OffscreenCanvasRenderer } from "./OffscreenCanvasRenderer";
import { PlotCoordinator } from "./PlotCoordinator";
import { PlotLegend } from "./PlotLegend";
import { CurrentCustomDatasetsBuilder } from "./builders/CurrentCustomDatasetsBuilder";
import { CustomDatasetsBuilder } from "./builders/CustomDatasetsBuilder";
import { IndexDatasetsBuilder } from "./builders/IndexDatasetsBuilder";
import { TimestampDatasetsBuilder } from "./builders/TimestampDatasetsBuilder";
import { isReferenceLinePlotPathType, PlotConfig } from "./config";
import { downloadCSV } from "./csv";
import { usePlotPanelSettings } from "./settings";
import { pathToSubscribePayload } from "./subscription";

export const defaultSidebarDimension = 240;

const useStyles = makeStyles()((theme) => ({
  tooltip: {
    maxWidth: "none",
  },
  resetZoomButton: {
    pointerEvents: "none",
    position: "absolute",
    display: "flex",
    justifyContent: "flex-end",
    paddingInline: theme.spacing(1),
    right: 0,
    left: 0,
    bottom: 0,
    width: "100%",
    paddingBottom: theme.spacing(4),

    [`.${buttonClasses.root}`]: {
      pointerEvents: "auto",
    },
  },
  canvasDiv: { width: "100%", height: "100%", overflow: "hidden", cursor: "crosshair" },
  verticalBarWrapper: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    position: "relative",
  },
}));

type Props = {
  config: PlotConfig;
  saveConfig: SaveConfig<PlotConfig>;
};

type ElementAtPixelArgs = {
  clientX: number;
  clientY: number;
  canvasX: number;
  canvasY: number;
};

const selectGlobalBounds = (store: TimelineInteractionStateStore) => store.globalBounds;
const selectSetGlobalBounds = (store: TimelineInteractionStateStore) => store.setGlobalBounds;

export function Plot(props: Props): JSX.Element {
  const { saveConfig, config } = props;
  const {
    paths: series,
    showLegend,
    xAxisVal: xAxisMode,
    xAxisPath,
    legendDisplay = config.showSidebar === true ? "left" : "floating",
    sidebarDimension = config.sidebarWidth ?? defaultSidebarDimension,
    [PANEL_TITLE_CONFIG_KEY]: customTitle,
  } = config;

  const { classes } = useStyles();
  const theme = useTheme();

  const { setMessagePathDropConfig } = usePanelContext();
  const draggingRef = useRef(false);

  useEffect(() => {
    setMessagePathDropConfig({
      getDropStatus(paths) {
        if (paths.some((path) => !path.isLeaf)) {
          return { canDrop: false };
        }
        return { canDrop: true, effect: "add" };
      },
      handleDrop(paths) {
        saveConfig((prevConfig) => ({
          ...prevConfig,
          paths: [
            ...prevConfig.paths,
            ...paths.map((path) => ({
              value: path.path,
              enabled: true,
              timestampMethod: "receiveTime" as const,
            })),
          ],
        }));
      },
    });
  }, [saveConfig, setMessagePathDropConfig]);

  const isMounted = useMountedState();
  const [focusedPath, setFocusedPath] = useState<undefined | string[]>(undefined);
  const [subscriberId] = useState(() => uuidv4());
  const [canvasDiv, setCanvasDiv] = useState<HTMLDivElement | ReactNull>(ReactNull);
  const [renderer, setRenderer] = useState<OffscreenCanvasRenderer | undefined>(undefined);
  const [coordinator, setCoordinator] = useState<PlotCoordinator | undefined>(undefined);

  // When true the user can reset the plot back to the original view
  const [canReset, setCanReset] = useState(false);

  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    data: TimeBasedChartTooltipData[];
  }>();

  usePlotPanelSettings(config, saveConfig, focusedPath);

  const setHoverValue = useSetHoverValue();
  const clearHoverValue = useClearHoverValue();

  const onClickPath = useCallback((index: number) => {
    setFocusedPath(["paths", String(index)]);
  }, []);

  const getMessagePipelineState = useMessagePipelineGetter();
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      // If we started a drag we should not register a seek
      if (draggingRef.current) {
        return;
      }

      // Only timestamp plots support click-to-seek
      if (xAxisMode !== "timestamp" || !coordinator) {
        return;
      }

      const {
        seekPlayback,
        playerState: { activeData: { startTime: start } = {} },
      } = getMessagePipelineState();

      if (!seekPlayback || !start) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;

      const seekSeconds = coordinator.getXValueAtPixel(mouseX);
      // Avoid normalizing a negative time if the clicked point had x < 0.
      if (seekSeconds >= 0) {
        seekPlayback(addTimes(start, fromSec(seekSeconds)));
      }
    },
    [coordinator, getMessagePipelineState, xAxisMode],
  );

  const getPanelContextMenuItems = useCallback(() => {
    const items: PanelContextMenuItem[] = [
      {
        type: "item",
        label: "Download plot data as CSV",
        onclick: async () => {
          const data = await coordinator?.getCsvData();
          if (!data || !isMounted()) {
            return;
          }

          downloadCSV(customTitle ?? "plot_data", data, xAxisMode);
        },
      },
    ];
    return items;
  }, [coordinator, customTitle, isMounted, xAxisMode]);

  const setSubscriptions = useMessagePipeline(
    useCallback(
      ({ setSubscriptions: pipelineSetSubscriptions }: MessagePipelineContext) =>
        pipelineSetSubscriptions,
      [],
    ),
  );
  const subscribeMessagePipeline = useMessagePipelineSubscribe();

  const { globalVariables } = useGlobalVariables();

  useEffect(() => {
    coordinator?.handleConfig(config, theme.palette.mode, globalVariables);
  }, [coordinator, config, globalVariables, theme.palette.mode]);

  // This effect must come after the one above it so the coordinator gets the latest config before
  // the latest player state and can properly initialize if the player state already contains the
  // data for display.
  useEffect(() => {
    if (!coordinator) {
      return;
    }

    const unsub = subscribeMessagePipeline((state) => {
      coordinator.handlePlayerState(state.playerState);
    });

    // Subscribing only gets us _new_ updates, so we feed the latest state into the chart
    coordinator.handlePlayerState(getMessagePipelineState().playerState);
    return unsub;
  }, [coordinator, getMessagePipelineState, subscribeMessagePipeline]);

  const datasetsBuilder = useMemo(() => {
    switch (xAxisMode) {
      case "timestamp":
        return new TimestampDatasetsBuilder();
      case "index":
        return new IndexDatasetsBuilder();
      case "custom":
        return new CustomDatasetsBuilder();
      case "currentCustom":
        return new CurrentCustomDatasetsBuilder();
      default:
        throw new Error(`unsupported mode: ${xAxisMode}`);
    }

    return undefined;
  }, [xAxisMode]);

  useEffect(() => {
    if (
      datasetsBuilder instanceof CurrentCustomDatasetsBuilder ||
      datasetsBuilder instanceof CustomDatasetsBuilder
    ) {
      if (!xAxisPath?.value) {
        datasetsBuilder.setXPath(undefined);
        return;
      }

      const parsed = parseMessagePath(xAxisPath.value);
      if (!parsed) {
        datasetsBuilder.setXPath(undefined);
        return;
      }

      datasetsBuilder.setXPath(fillInGlobalVariablesInPath(parsed, globalVariables));
    }
  }, [datasetsBuilder, globalVariables, xAxisPath]);

  useEffect(() => {
    if (!canvasDiv) {
      return;
    }

    const clientRect = canvasDiv.getBoundingClientRect();

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // So the canvas does not affect the size of the parent
    canvas.style.position = "absolute";
    canvas.width = clientRect.width;
    canvas.height = clientRect.height;
    canvasDiv.appendChild(canvas);

    const offscreenCanvas = canvas.transferControlToOffscreen();
    setRenderer(new OffscreenCanvasRenderer(offscreenCanvas, theme));

    return () => {
      canvasDiv.removeChild(canvas);
    };
  }, [canvasDiv, theme]);

  useEffect(() => {
    if (!renderer || !datasetsBuilder || !canvasDiv) {
      return;
    }

    const contentRect = canvasDiv.getBoundingClientRect();

    const plotCoordinator = new PlotCoordinator(renderer, datasetsBuilder);
    setCoordinator(plotCoordinator);

    plotCoordinator.setSize({
      width: contentRect.width,
      height: contentRect.height,
    });

    const isCanvasTarget = (entry: Immutable<ResizeObserverEntry>) => entry.target === canvasDiv;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = _.findLast(entries, isCanvasTarget);
      if (entry) {
        plotCoordinator.setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(canvasDiv);

    return () => {
      resizeObserver.disconnect();
      plotCoordinator.destroy();
    };
  }, [canvasDiv, datasetsBuilder, renderer]);

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      if (!coordinator) {
        return;
      }

      const boundingRect = event.currentTarget.getBoundingClientRect();
      coordinator.addInteractionEvent({
        type: "wheel",
        cancelable: false,
        deltaY: event.deltaY,
        deltaX: event.deltaX,
        clientX: event.clientX,
        clientY: event.clientY,
        boundingClientRect: boundingRect.toJSON(),
      });
    },
    [coordinator],
  );

  const mousePresentRef = useRef(false);

  const buildTooltip = useMemo(() => {
    return debouncePromise(async (args: ElementAtPixelArgs) => {
      const elements = await renderer?.getElementsAtPixel({
        x: args.canvasX,
        y: args.canvasY,
      });

      if (!isMounted()) {
        return;
      }

      // Looking up a tooltip is an async operation so the mouse might leave the component while
      // that is happening and we need to avoid showing a tooltip.
      if (!elements || elements.length === 0 || !mousePresentRef.current) {
        setActiveTooltip(undefined);
        return;
      }

      const tooltipItems: TimeBasedChartTooltipData[] = [];

      for (const element of elements) {
        const value = element.data.value ?? element.data.y;
        const tooltipValue = typeof value === "object" && isTime(value) ? toSec(value) : value;

        tooltipItems.push({
          configIndex: element.configIndex,
          value: tooltipValue,
        });
      }

      if (tooltipItems.length === 0) {
        setActiveTooltip(undefined);
        return;
      }

      setActiveTooltip({
        x: args.clientX,
        y: args.clientY,
        data: tooltipItems,
      });
    });
  }, [renderer, isMounted]);

  // Extract the bounding client rect from currentTarget before calling the debounced function
  // because react re-uses the SyntheticEvent objects.
  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      mousePresentRef.current = true;
      const boundingRect = event.currentTarget.getBoundingClientRect();
      buildTooltip({
        clientX: event.clientX,
        clientY: event.clientY,
        canvasX: event.clientX - boundingRect.left,
        canvasY: event.clientY - boundingRect.top,
      });

      if (!coordinator) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const seconds = coordinator.getXValueAtPixel(mouseX);

      setHoverValue({
        componentId: subscriberId,
        value: seconds,
        type: xAxisMode === "timestamp" ? "PLAYBACK_SECONDS" : "OTHER",
      });
    },
    [buildTooltip, coordinator, setHoverValue, subscriberId, xAxisMode],
  );

  const onMouseOut = useCallback(() => {
    mousePresentRef.current = false;
    setActiveTooltip(undefined);
    clearHoverValue(subscriberId);
  }, [clearHoverValue, subscriberId]);

  const { colorsByDatasetIndex, labelsByDatasetIndex } = useMemo(() => {
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};

    for (let idx = 0; idx < config.paths.length; ++idx) {
      const item = config.paths[idx]!;
      labels[idx] = item.label ?? item.value;
      colors[idx] = getLineColor(item.color, idx);
    }

    return {
      colorsByDatasetIndex: colors,
      labelsByDatasetIndex: labels,
    };
  }, [config.paths]);

  const numSeries = config.paths.length;
  const tooltipContent = useMemo(() => {
    return activeTooltip ? (
      <TimeBasedChartTooltipContent
        content={activeTooltip.data}
        multiDataset={numSeries > 1}
        colorsByConfigIndex={colorsByDatasetIndex}
        labelsByConfigIndex={labelsByDatasetIndex}
      />
    ) : undefined;
  }, [activeTooltip, colorsByDatasetIndex, labelsByDatasetIndex, numSeries]);

  // panning
  useEffect(() => {
    if (!canvasDiv || !coordinator) {
      return;
    }

    const hammerManager = new Hammer.Manager(canvasDiv);
    const threshold = 10;
    hammerManager.add(new Hammer.Pan({ threshold }));

    hammerManager.on("panstart", (event) => {
      draggingRef.current = true;
      const boundingRect = event.target.getBoundingClientRect();
      coordinator.addInteractionEvent({
        type: "panstart",
        cancelable: false,
        deltaY: event.deltaY,
        deltaX: event.deltaX,
        center: {
          x: event.center.x,
          y: event.center.y,
        },
        boundingClientRect: boundingRect.toJSON(),
      });
    });

    hammerManager.on("panmove", (event) => {
      const boundingRect = event.target.getBoundingClientRect();
      coordinator.addInteractionEvent({
        type: "panmove",
        cancelable: false,
        deltaY: event.deltaY,
        deltaX: event.deltaX,
        boundingClientRect: boundingRect.toJSON(),
      });
    });

    hammerManager.on("panend", (event) => {
      const boundingRect = event.target.getBoundingClientRect();
      coordinator.addInteractionEvent({
        type: "panend",
        cancelable: false,
        deltaY: event.deltaY,
        deltaX: event.deltaX,
        boundingClientRect: boundingRect.toJSON(),
      });

      // We need to do this a little bit later so that the onClick handler still sees
      // draggingRef.current===true and can skip the seek.
      setTimeout(() => {
        draggingRef.current = false;
      }, 0);
    });

    return () => {
      hammerManager.destroy();
    };
  }, [canvasDiv, coordinator]);

  // We could subscribe in the chart renderer, but doing it with react effects is easier for
  // managing the lifecycle of the subscriptions. The renderer will correlate input message data to
  // the correct series.
  useEffect(() => {
    // The index and currentCustom modes only need the latest message on each topic so we use
    // partial subscribe mode for those to avoid preloading data that we don't need
    const preloadType = xAxisMode === "index" || xAxisMode === "currentCustom" ? "partial" : "full";

    const subscriptions = filterMap(series, (item): SubscribePayload | undefined => {
      if (isReferenceLinePlotPathType(item)) {
        return;
      }

      const parsed = parseMessagePath(item.value);
      if (!parsed) {
        return;
      }

      return pathToSubscribePayload(
        fillInGlobalVariablesInPath(parsed, globalVariables),
        preloadType,
      );
    });

    if ((xAxisMode === "custom" || xAxisMode === "currentCustom") && xAxisPath) {
      const parsed = parseMessagePath(xAxisPath.value);
      if (parsed) {
        const sub = pathToSubscribePayload(
          fillInGlobalVariablesInPath(parsed, globalVariables),
          preloadType,
        );
        if (sub) {
          subscriptions.push(sub);
        }
      }
    }

    setSubscriptions(subscriberId, subscriptions);
  }, [series, setSubscriptions, subscriberId, globalVariables, xAxisMode, xAxisPath]);

  // Only unsubscribe on unmount so that when the above subscriber effect dependencies change we
  // don't transition to unsubscribing all to then re-subscribe.
  useEffect(() => {
    return () => {
      setSubscriptions(subscriberId, []);
    };
  }, [subscriberId, setSubscriptions]);

  const globalBounds = useTimelineInteractionState(selectGlobalBounds);
  const setGlobalBounds = useTimelineInteractionState(selectSetGlobalBounds);

  const shouldSync = config.xAxisVal === "timestamp" && config.isSynced;

  useEffect(() => {
    if (globalBounds?.sourceId === subscriberId || !shouldSync) {
      return;
    }

    coordinator?.setGlobalBounds(globalBounds);
  }, [coordinator, globalBounds, shouldSync, subscriberId]);

  useEffect(() => {
    if (!coordinator || !shouldSync) {
      return;
    }

    const onTimeseriesBounds = (newBounds: Immutable<Bounds1D>) => {
      setGlobalBounds({
        min: newBounds.min,
        max: newBounds.max,
        sourceId: subscriberId,
        userInteraction: true,
      });
    };
    coordinator.on("timeseriesBounds", onTimeseriesBounds);
    coordinator.on("viewportChange", setCanReset);
    return () => {
      coordinator.off("timeseriesBounds", onTimeseriesBounds);
      coordinator.off("viewportChange", setCanReset);
    };
  }, [coordinator, setGlobalBounds, shouldSync, subscriberId]);

  const onResetView = useCallback(() => {
    if (!coordinator) {
      return;
    }

    coordinator.resetBounds();

    if (shouldSync) {
      setGlobalBounds(undefined);
    }
  }, [coordinator, setGlobalBounds, shouldSync]);

  const hoveredValuesBySeriesIndex = useMemo(() => {
    if (!config.showPlotValuesInLegend) {
      return;
    }

    if (!activeTooltip?.data) {
      return;
    }

    const values = new Array(config.paths.length).fill(undefined);
    for (const item of activeTooltip.data) {
      values[item.configIndex] ??= item.value;
    }

    return values;
  }, [activeTooltip, config.paths.length, config.showPlotValuesInLegend]);

  const { keyDownHandlers, keyUphandlers } = useMemo(() => {
    return {
      keyDownHandlers: {
        v: () => {
          coordinator?.setZoomMode("y");
        },
        b: () => {
          coordinator?.setZoomMode("xy");
        },
      },
      keyUphandlers: {
        v: () => {
          coordinator?.setZoomMode("x");
        },
        b: () => {
          coordinator?.setZoomMode("x");
        },
      },
    };
  }, [coordinator]);

  return (
    <Stack
      flex="auto"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      position="relative"
    >
      <PanelToolbar />
      <Stack
        direction={legendDisplay === "top" ? "column" : "row"}
        flex="auto"
        fullWidth
        style={{ height: `calc(100% - ${PANEL_TOOLBAR_MIN_HEIGHT}px)` }}
        position="relative"
      >
        {/* Pass stable values here for properties when not showing values so that the legend memoization remains stable. */}
        {legendDisplay !== "none" && (
          <PlotLegend
            coordinator={coordinator}
            legendDisplay={legendDisplay}
            onClickPath={onClickPath}
            paths={series}
            saveConfig={saveConfig}
            showLegend={showLegend}
            sidebarDimension={sidebarDimension}
            showValues={config.showPlotValuesInLegend}
            hoveredValuesBySeriesIndex={hoveredValuesBySeriesIndex}
          />
        )}
        <Tooltip
          arrow={false}
          classes={{ tooltip: classes.tooltip }}
          open={tooltipContent != undefined}
          placement="right"
          title={tooltipContent ?? <></>}
          disableInteractive
          followCursor
          TransitionComponent={Fade}
          TransitionProps={{ timeout: 0 }}
        >
          <div className={classes.verticalBarWrapper}>
            <div
              className={classes.canvasDiv}
              ref={setCanvasDiv}
              onWheel={onWheel}
              onMouseMove={onMouseMove}
              onMouseOut={onMouseOut}
              onClick={onClick}
              onDoubleClick={onResetView}
            />
            <VerticalBars
              coordinator={coordinator}
              hoverComponentId={subscriberId}
              xAxisIsPlaybackTime={xAxisMode === "timestamp"}
            />
          </div>
        </Tooltip>
        {canReset && (
          <div className={classes.resetZoomButton}>
            <Button
              variant="contained"
              color="inherit"
              title="(shortcut: double-click)"
              onClick={onResetView}
            >
              Reset view
            </Button>
          </div>
        )}
        <PanelContextMenu getItems={getPanelContextMenuItems} />
      </Stack>
      <KeyListener global keyDownHandlers={keyDownHandlers} keyUpHandlers={keyUphandlers} />
    </Stack>
  );
}
