// src/components/SinglePlot.tsx
import { Button, Tooltip, Fade, useTheme } from "@mui/material";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import _ from "lodash-es";

import Stack from "@lichtblick/suite-base/components/Stack";
import TimeBasedChartTooltipContent from "@lichtblick/suite-base/components/TimeBasedChart/TimeBasedChartTooltipContent";
import { VerticalBars } from "@lichtblick/suite-base/panels/Plot/VerticalBars";
import { DEFAULT_SIDEBAR_DIMENSION } from "@lichtblick/suite-base/panels/Plot/constants";
import usePanning from "@lichtblick/suite-base/panels/Plot/hooks/usePanning";
import { PlotProps } from "@lichtblick/suite-base/panels/Plot/types";

import { useStyles } from "@lichtblick/suite-base/panels/Plot/Plot.style";
import { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import { PlotLegend } from "@lichtblick/suite-base/panels/Plot/PlotLegend";
import useGlobalSync from "@lichtblick/suite-base/panels/Plot/hooks/useGlobalSync";
import usePlotDataHandling from "@lichtblick/suite-base/panels/Plot/hooks/usePlotDataHandling";
import useRenderer from "@lichtblick/suite-base/panels/Plot/hooks/useRenderer";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import { useTranslation } from "react-i18next";
import { SettingsTreeAction } from "@lichtblick/suite";
import { produce } from "immer";
import { buildSettingsTree } from "@lichtblick/suite-base/panels/Plot/utils/buildSettingsTree";
import {
  handleAddSeriesAction, handleDeleteSeriesAction,
  handleUpdateAction
} from "@lichtblick/suite-base/panels/Plot/hooks/usePlotPanelSettings";

type SinglePlotProps = PlotProps & {
  configPath: string; // 强制要求唯一路径
  panelId: string;     // 添加唯一面板ID
  onSelect: () => void; // 添加选中回调
};
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useRef, useMemo, useState } from "react";
import { useMountedState } from "react-use";

import { debouncePromise } from "@lichtblick/den/async";
import { add as addTimes, fromSec, isTime, toSec } from "@lichtblick/rostime";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { PanelContextMenuItem } from "@lichtblick/suite-base/components/PanelContextMenu";
import { TimeBasedChartTooltipData } from "@lichtblick/suite-base/components/TimeBasedChart/TimeBasedChartTooltipContent";
import {
  TimelineInteractionStateStore,
  useClearHoverValue,
  useSetHoverValue,
  useTimelineInteractionState,
} from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import {
  ElementAtPixelArgs,
  UseHoverHandlersHook as UsePlotInteractionHandlers,
  UsePlotInteractionHandlersProps,
} from "@lichtblick/suite-base/panels/Plot/types";
import { downloadCSV } from "@lichtblick/suite-base/panels/Plot/utils/csv";
import { PANEL_TITLE_CONFIG_KEY } from "@lichtblick/suite-base/util/layout";

const selectSetGlobalBounds = (store: TimelineInteractionStateStore) => store.setGlobalBounds;
type  NewUsePlotInteractionHandlersProps = UsePlotInteractionHandlersProps&{
  configPath: string; // 强制要求唯一路径
  onSelect: () => void; // 添加选中回调
}
const usePlotInteractionHandlers = ({
                                      config,
                                      coordinator,
                                      draggingRef,
                                      renderer,
                                      setActiveTooltip,
                                      shouldSync,
                                      subscriberId,
  configPath,onSelect,
                                    }: NewUsePlotInteractionHandlersProps): UsePlotInteractionHandlers => {
  const setHoverValue = useSetHoverValue();
  const clearHoverValue = useClearHoverValue();
  const isMounted = useMountedState();
  const mousePresentRef = useRef(false);
  const { xAxisVal: xAxisMode, [PANEL_TITLE_CONFIG_KEY]: customTitle } = config;
  const setGlobalBounds = useTimelineInteractionState(selectSetGlobalBounds);
  const getMessagePipelineState = useMessagePipelineGetter();
  const [focusedPath, setFocusedPath] = useState<undefined | string[]>(undefined);

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

      setActiveTooltip({
        x: args.clientX,
        y: args.clientY,
        data: tooltipItems,
      });
    });
  }, [renderer, isMounted, setActiveTooltip]);

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
  }, [clearHoverValue, subscriberId, setActiveTooltip]);

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

  const onResetView = useCallback(() => {
    if (!coordinator) {
      return;
    }

    coordinator.resetBounds();

    if (shouldSync) {
      setGlobalBounds(undefined);
    }
  }, [coordinator, setGlobalBounds, shouldSync]);

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
    [coordinator, draggingRef, getMessagePipelineState, xAxisMode],
  );

  // 修改usePlotInteractionHandlers中的onClickPath
  const onClickPath = useCallback(() => {
    // 生成包含panelId的复合路径
    const fullPath = `${configPath}`;
    // 触发父级选中事件
    onSelect();
    // 传递到焦点系统
    setFocusedPath([fullPath]);
  }, [configPath, onSelect]);

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

  return {
    onMouseMove,
    onMouseOut,
    onWheel,
    onResetView,
    onClick,
    onClickPath,
    focusedPath,
    keyDownHandlers,
    keyUphandlers,
    getPanelContextMenuItems,
  };
};



const SinglePlot = ({ config, saveConfig,configPath,onSelect}: SinglePlotProps) => {
    const { classes } = useStyles();
    const theme = useTheme();
    const draggingRef = useRef(false);
    const [canvasDiv, setCanvasDiv] = useState<HTMLDivElement | null>(null);
    const [coordinator, setCoordinator] = useState<PlotCoordinator | undefined>(undefined);
    const [canReset, setCanReset] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<any>();
    const [subscriberId] = useState(() => uuidv4());

    const series = config.paths;
    const xAxisMode = config.xAxisVal;
    const legendDisplay = config.legendDisplay ?? (config.showSidebar ? "left" : "floating");
    const sidebarDimension = config.sidebarWidth ?? DEFAULT_SIDEBAR_DIMENSION;
    const shouldSync = config.isSynced;

    const renderer = useRenderer(canvasDiv, theme);
    const { colorsByDatasetIndex, labelsByDatasetIndex, datasetsBuilder } = usePlotDataHandling(
      config,
      {},
    );

    // @ts-ignore
  const {
      onMouseMove,
      onMouseOut,
      onResetView,
      onWheel,
      onClick,
      onClickPath,
      focusedPath,
    } = usePlotInteractionHandlers({
      config,
      coordinator,
      draggingRef,
      setActiveTooltip,
      renderer,
      shouldSync,
      subscriberId,
    //@ts-ignore
      configPath,
      onSelect,
    });


    function usePlotPanelSettings(
      config: PlotConfig,
      saveConfig: SaveConfig<PlotConfig>,
      focusedPath?: readonly string[],
      configPath?: string, // 新增参数
    ): void {
      const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
      const { t } = useTranslation("plot");

      const actionHandler = useCallback(
        ({ action, payload }: SettingsTreeAction) => {
          if (action === "update") {
            const { path, value } = payload;
            saveConfig(
              produce((draft: PlotConfig) => {
                handleUpdateAction({ draft, path, value });
              }),
            );
          } else if (payload.id === "add-series") {
            saveConfig(
              produce<PlotConfig>((draft: PlotConfig) => {
                handleAddSeriesAction({ draft });
              }),
            );
          } else if (payload.id === "delete-series") {
            saveConfig(
              produce<PlotConfig>((draft) => {
                handleDeleteSeriesAction({ draft, index: Number(payload.path[1]) });
              }),
            );
          }
        },
        [saveConfig],
      );

      useEffect(() => {
        console.log("start")
        console.log("focusedPath:", focusedPath);
        console.log("configPath:", configPath);
        console.log("end")
        if (
          configPath &&
          focusedPath &&
          focusedPath.length > 0 &&
          focusedPath[0] !== configPath
        ) {
          return; // 不执行更新
        }
        updatePanelSettingsTree({
          actionHandler,
          focusedPath,
          nodes: buildSettingsTree(config, t),
        });
      }, [
        // actionHandler,    //会导致多次选择focusPath 关闭后可解决
        config,
        focusedPath,
        // updatePanelSettingsTree,    //会导致多次选择focusPath 关闭后可解决
        t,
        configPath,
      ]);
    }

    usePlotPanelSettings(config, saveConfig, focusedPath, configPath);
    useGlobalSync(coordinator, setCanReset, { shouldSync }, subscriberId);
    usePanning(canvasDiv, coordinator, draggingRef);

    useEffect(() => {
      const contentRect = canvasDiv?.getBoundingClientRect();
      if (!renderer || !canvasDiv || !contentRect) return;

      const plotCoordinator = new PlotCoordinator(renderer, datasetsBuilder);
      setCoordinator(plotCoordinator);
      plotCoordinator.setSize({ width: contentRect.width, height: contentRect.height });

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries.find((e) => e.target === canvasDiv);
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

    const tooltipContent = useMemo(() => {
      return activeTooltip ? (
        <TimeBasedChartTooltipContent
          content={activeTooltip.data}
          multiDataset={config.paths.length > 1}
          colorsByConfigIndex={colorsByDatasetIndex}
          labelsByConfigIndex={labelsByDatasetIndex}
        />
      ) : undefined;
    }, [activeTooltip, colorsByDatasetIndex, labelsByDatasetIndex, config.paths.length]);

    const hoveredValuesBySeriesIndex = useMemo(() => {
      if (!config.showPlotValuesInLegend || !activeTooltip?.data) return;

      const values = new Array(config.paths.length).fill(undefined);
      for (const item of activeTooltip.data) {
        values[item.configIndex] ??= item.value;
      }
      return values;
    }, [activeTooltip, config]);

    return (

      <Stack
        flex="auto"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        position="relative"
      >

        <Stack
          direction={legendDisplay === "top" ? "column" : "row"}
          flex="auto"
          fullWidth
          style={{ height: "100%" }}
          position="relative"
        >
          {legendDisplay !== "none" && (
            <PlotLegend
              coordinator={coordinator}
              legendDisplay={legendDisplay}
              onClickPath={onClickPath}
              paths={series}
              saveConfig={saveConfig}
              showLegend={config.showLegend}
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
              <Button variant="contained" color="inherit" onClick={onResetView}>
                重置视图
              </Button>
            </div>
          )}
        </Stack>
      </Stack>
    );
  };

  export default SinglePlot;

