// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Tooltip, Fade, useTheme } from "@mui/material";
import * as _ from "lodash-es";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import { Immutable } from "@lichtblick/suite";
import KeyListener from "@lichtblick/suite-base/components/KeyListener";
import {
  useMessagePipelineGetter,
  useMessagePipelineSubscribe,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import { PanelContextMenu } from "@lichtblick/suite-base/components/PanelContextMenu";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import { PANEL_TOOLBAR_MIN_HEIGHT } from "@lichtblick/suite-base/components/PanelToolbar/constants";
import Stack from "@lichtblick/suite-base/components/Stack";
import TimeBasedChartTooltipContent from "@lichtblick/suite-base/components/TimeBasedChart/TimeBasedChartTooltipContent";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { VerticalBars } from "@lichtblick/suite-base/panels/Plot/VerticalBars";
import { DEFAULT_SIDEBAR_DIMENSION } from "@lichtblick/suite-base/panels/Plot/constants";
import usePanning from "@lichtblick/suite-base/panels/Plot/hooks/usePanning";
import usePlotInteractionHandlers from "@lichtblick/suite-base/panels/Plot/hooks/usePlotInteractionHandlers";
import { PlotProps, TooltipStateSetter } from "@lichtblick/suite-base/panels/Plot/types";

import { useStyles } from "./Plot.style";
import { PlotCoordinator } from "./PlotCoordinator";
import { PlotLegend } from "./PlotLegend";
import useGlobalSync from "./hooks/useGlobalSync";
import usePlotDataHandling from "./hooks/usePlotDataHandling";
import usePlotPanelSettings from "./hooks/usePlotPanelSettings";
import useRenderer from "./hooks/useRenderer";
import useSubscriptions from "./hooks/useSubscriptions";

const Plot = (props: PlotProps): React.JSX.Element => {
  const { saveConfig, config } = props;
  const {
    paths: series,
    showLegend,
    xAxisVal: xAxisMode,
    legendDisplay = config.showSidebar === true ? "left" : "floating",
    sidebarDimension = config.sidebarWidth ?? DEFAULT_SIDEBAR_DIMENSION,
  } = config;

  const { classes } = useStyles();
  const theme = useTheme();
  const { t } = useTranslation("plot");

  const { setMessagePathDropConfig } = usePanelContext();
  const draggingRef = useRef(false);

  // When true the user can reset the plot back to the original view
  const [canReset, setCanReset] = useState(false);

  const [activeTooltip, setActiveTooltip] = useState<TooltipStateSetter>();

  const [subscriberId] = useState(() => uuidv4());
  const [canvasDiv, setCanvasDiv] = useState<HTMLDivElement | ReactNull>(ReactNull);
  const [coordinator, setCoordinator] = useState<PlotCoordinator | undefined>(undefined);
  const shouldSync = config.isSynced;
  const renderer = useRenderer(canvasDiv, theme);
  const { globalVariables } = useGlobalVariables();
  const getMessagePipelineState = useMessagePipelineGetter();
  const subscribeMessagePipeline = useMessagePipelineSubscribe();

  const {
    onMouseMove,
    onMouseOut,
    onResetView,
    onWheel,
    onClick,
    onClickPath,
    focusedPath,
    keyDownHandlers,
    keyUphandlers,
    getPanelContextMenuItems,
  } = usePlotInteractionHandlers({
    config,
    coordinator,
    draggingRef,
    setActiveTooltip,
    renderer,
    shouldSync,
    subscriberId,
  });

  usePlotPanelSettings(config, saveConfig, focusedPath);
  useSubscriptions(config, subscriberId);
  useGlobalSync(coordinator, setCanReset, { shouldSync }, subscriberId);
  usePanning(canvasDiv, coordinator, draggingRef);
  const { colorsByDatasetIndex, labelsByDatasetIndex, datasetsBuilder } = usePlotDataHandling(
    config,
    globalVariables,
  );

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

  useEffect(() => {
    if (coordinator) {
      coordinator.setShouldSync({ shouldSync });
    }
  }, [coordinator, shouldSync]);

  useEffect(() => {
    if (!renderer || !canvasDiv) {
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
      if (entry != undefined) {
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

  const hoveredValuesBySeriesIndex = useMemo(() => {
    if (!config.showPlotValuesInLegend || !activeTooltip?.data) {
      return;
    }

    const values = new Array(config.paths.length).fill(undefined);
    for (const item of activeTooltip.data) {
      values[item.configIndex] ??= item.value;
    }

    return values;
  }, [activeTooltip, config.paths.length, config.showPlotValuesInLegend]);

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
          slots={{ transition: Fade }}
          slotProps={{ transition: { timeout: 0 } }}
        >
          <div className={classes.verticalBarWrapper} data-testid="vertical-bar-wrapper">
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
          <div className={classes.resetZoomButton} data-testid="plot-reset-view-button">
            <Button
              variant="contained"
              color="inherit"
              title="(shortcut: double-click)"
              onClick={onResetView}
            >
              {t("resetView")}
            </Button>
          </div>
        )}
        <PanelContextMenu getItems={getPanelContextMenuItems} />
      </Stack>
      <KeyListener global keyDownHandlers={keyDownHandlers} keyUpHandlers={keyUphandlers} />
    </Stack>
  );
};

export default Plot;
