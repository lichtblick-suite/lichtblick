// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
import { useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { makeStyles } from "tss-react/mui";

import { useAppTimeFormat } from "@lichtblick/suite-base/hooks";
import { NormalizedLogMessage } from "@lichtblick/suite-base/panels/Log/types";

import LogMessage from "./LogMessage";

const useStyles = makeStyles()((theme) => ({
  floatingButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    margin: theme.spacing(1.5),
  },
}));

type Props = {
  items: readonly NormalizedLogMessage[];
};

// function Row(props: {
//   data: ListItemData;
//   index: number;
//   style: CSSProperties;
// }): React.JSX.Element {
//   const { timeFormat, timeZone } = useAppTimeFormat();
//   const ref = useRef<HTMLDivElement>(ReactNull);

//   useEffect(() => {
//     if (ref.current) {
//       props.data.setRowHeight(props.index, ref.current.clientHeight);
//     }
//   }, [props.data, props.index]);

//   const item = props.data.items[props.index]!;

//   return (
//     <div style={{ ...props.style, height: "auto" }} ref={ref}>
//       <LogMessage value={item} timestampFormat={timeFormat} timeZone={timeZone} />
//     </div>
//   );
// }

/**
 * List for showing large number of items, which are expected to be appended to the end regularly.
 * Automatically scrolls to the bottom unless you explicitly scroll up.
 */
function LogList({ items }: Props): React.JSX.Element {
  const { classes } = useStyles();
  const { timeFormat, timeZone } = useAppTimeFormat();

  // Reference to the list item itself.
  const virtuosoRef = useRef<VirtuosoHandle>(ReactNull);

  // Automatically scroll to reveal new items.
  const [autoscrollToEnd, setAutoscrollToEnd] = useState(true);

  // Buffering mechanism
  const [displayedItems, setDisplayedItems] = useState<readonly NormalizedLogMessage[]>([]);
  const bufferRef = useRef<readonly NormalizedLogMessage[]>([]);
  const lastProcessedIndex = useRef(0);

  // Buffer new items and flush periodically
  useEffect(() => {
    // Add new items to buffer
    if (items.length > lastProcessedIndex.current) {
      const newItems = items.slice(lastProcessedIndex.current);
      bufferRef.current = [...bufferRef.current, ...newItems];
      lastProcessedIndex.current = items.length;
    }
  }, [items]);

  // Flush buffer to displayed items
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (bufferRef.current.length > 0) {
          // When following, flush all buffered items
          // When not following, only flush a smaller batch to avoid jumps
          const batchSize = autoscrollToEnd
            ? bufferRef.current.length
            : Math.min(50, bufferRef.current.length);
          const itemsToFlush = bufferRef.current.slice(0, batchSize);

          setDisplayedItems((prev) => [...prev, ...itemsToFlush]);
          bufferRef.current = bufferRef.current.slice(batchSize);
        }
      },
      autoscrollToEnd ? 50 : 200,
    ); // Faster flush when following, slower when not

    return () => {
      clearInterval(interval);
    };
  }, [autoscrollToEnd]);

  // Track if we're receiving data actively
  const lastUpdateTime = useRef(Date.now());
  const [isReceivingData, setIsReceivingData] = useState(false);

  useEffect(() => {
    if (items.length > 0) {
      lastUpdateTime.current = Date.now();
      setIsReceivingData(true);

      // Check if data flow has stopped
      const timeout = setTimeout(() => {
        const timeSinceUpdate = Date.now() - lastUpdateTime.current;
        if (timeSinceUpdate >= 1000) {
          setIsReceivingData(false);
        }
      }, 1000);

      return () => {
        clearTimeout(timeout);
      };
    }
    return () => {};
  }, [items.length]);

  const scrollToBottom = useCallback(() => {
    setAutoscrollToEnd(true);
    virtuosoRef.current?.scrollToIndex({
      index: items.length - 1,
      align: "end",
    });
  }, [items.length]);

  const itemRenderer = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) {
        return ReactNull;
      }

      return <LogMessage value={item} timestampFormat={timeFormat} timeZone={timeZone} />;
    },
    [items, timeFormat, timeZone],
  );

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <Virtuoso
        ref={virtuosoRef}
        totalCount={displayedItems.length}
        itemContent={itemRenderer}
        followOutput={autoscrollToEnd ? "auto" : false}
        atBottomStateChange={(atBottom) => {
          // Only disable auto-scroll when user scrolls up AND data is not actively flowing
          if (!atBottom && autoscrollToEnd && !isReceivingData) {
            // eslint-disable-next-line no-restricted-syntax
            console.info("setting autoscroll to false");
            setAutoscrollToEnd(false);
          }
        }}
        style={{ height: "100%" }}
      />

      {/* Only show button when paused AND scrolled up from bottom */}
      {!autoscrollToEnd && (
        <Fab
          size="small"
          title="Scroll to bottom"
          onClick={scrollToBottom}
          className={classes.floatingButton}
        >
          <DoubleArrowDownIcon />
        </Fab>
      )}
    </div>
  );
}

export default LogList;
