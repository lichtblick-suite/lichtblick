// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import DoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import { Fab } from "@mui/material";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import { useLatest } from "react-use";
import AutoSizer from "react-virtualized-auto-sizer";
import { List, ListImperativeAPI, RowComponentProps } from "react-window";

import { useAppTimeFormat } from "@lichtblick/suite-base/hooks";
import { NormalizedLogMessage } from "@lichtblick/suite-base/panels/Log/types";

import { useStyles } from "./LogList.style";
import LogMessage from "./LogMessage";
import { DEFAULT_ROW_HEIGHT } from "./constants";

export type LogListProps = {
  items: readonly NormalizedLogMessage[];
};

type ListItemData = {
  items: readonly NormalizedLogMessage[];
  setRowHeight: (index: number, height: number) => void;
  /** Incremented when heights change; passed through rowProps so List re-calls rowHeight. */
  heightVersion: number;
  /** Included so the Row effect re-fires when the container width changes. */
  resizedWidth: number | undefined;
};

function Row(props: RowComponentProps<ListItemData>): React.JSX.Element {
  const { setRowHeight, index, style, items, resizedWidth } = props;
  const { timeFormat, timeZone } = useAppTimeFormat();
  const ref = useRef<HTMLDivElement>(ReactNull);

  useEffect(() => {
    if (ref.current) {
      setRowHeight(index, ref.current.clientHeight);
    }
  }, [index, setRowHeight, resizedWidth]);

  const item = items[index]!;

  return (
    <div style={{ ...style, height: "auto" }} ref={ref}>
      <LogMessage value={item} timestampFormat={timeFormat} timeZone={timeZone} />
    </div>
  );
}

/**
 * List for showing large number of items, which are expected to be appended to the end regularly.
 * Automatically scrolls to the bottom unless you explicitly scroll up.
 */
function LogList({ items }: LogListProps): React.JSX.Element {
  const { classes } = useStyles();

  // Reference to the list item itself.
  const listRef = useRef<ListImperativeAPI>(ReactNull);

  const latestItems = useLatest(items);

  const itemHeightCache = useRef<Record<number, number>>({});
  const [heightVersion, forceHeightUpdate] = useReducer((n: number) => n + 1, 0);

  const setRowHeight = useCallback((index: number, height: number) => {
    if (itemHeightCache.current[index] !== height) {
      itemHeightCache.current[index] = height;
      forceHeightUpdate();
    }
  }, []);

  const getRowHeight = useCallback(
    (index: number, _rowProps: ListItemData) =>
      itemHeightCache.current[index] ?? DEFAULT_ROW_HEIGHT,
    [],
  );

  const { width: resizedWidth, ref: resizeRootRef } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  // Automatically scroll to reveal new items.
  const [autoscrollToEnd, setAutoscrollToEnd] = useState(true);

  const onResetView = React.useCallback(() => {
    setAutoscrollToEnd(true);
    if (latestItems.current.length > 0) {
      listRef.current?.scrollToRow({ index: latestItems.current.length - 1, align: "end" });
    }
  }, [latestItems]);

  useEffect(() => {
    if (autoscrollToEnd && items.length > 0) {
      listRef.current?.scrollToRow({ index: items.length - 1, align: "end" });
    }
  }, [autoscrollToEnd, items.length]);

  // Disable autoscroll if the user manually scrolls back.
  const onScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    try {
      const target = event.currentTarget;
      const { scrollTop, offsetHeight, scrollHeight } = target;
      const isAtEnd = scrollTop + offsetHeight >= scrollHeight - 1;
      if (!isAtEnd) {
        setAutoscrollToEnd(false);
      } else {
        setAutoscrollToEnd(true);
      }
    } catch (error) {
      console.error("Error while handling scroll", error);
    }
  }, []);

  // This is passed to each row to tell it what to render.
  const itemData = useMemo(
    () => ({
      items,
      setRowHeight,
      heightVersion,
      resizedWidth,
    }),
    [items, setRowHeight, heightVersion, resizedWidth],
  );

  return (
    <AutoSizer>
      {({ width, height }) => {
        return (
          <div
            style={{ position: "relative", width, height }}
            ref={resizeRootRef}
            data-testid="virtualized-list"
          >
            <List<ListItemData>
              listRef={listRef}
              style={{ outline: "none", width, height }}
              rowProps={itemData}
              rowHeight={getRowHeight}
              rowCount={items.length}
              onScroll={onScroll}
              rowComponent={Row}
              data-testid="scrollable-list"
            />

            {!autoscrollToEnd && (
              <Fab
                size="small"
                title="Scroll to bottom"
                onClick={onResetView}
                className={classes.floatingButton}
                data-testid="scroll-to-bottom-button"
              >
                <DoubleArrowDownIcon />
              </Fab>
            )}
          </div>
        );
      }}
    </AutoSizer>
  );
}

export default LogList;
