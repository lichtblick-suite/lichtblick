// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

const usePlotInteractionHandlers = ({
  config,
  coordinator,
  draggingRef,
  renderer,
  setActiveTooltip,
  shouldSync,
  subscriberId,
}: UsePlotInteractionHandlersProps): UsePlotInteractionHandlers => {
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

  const onClickPath = useCallback((index: number) => {
    setFocusedPath(["paths", String(index)]);
  }, []);

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

export default usePlotInteractionHandlers;
