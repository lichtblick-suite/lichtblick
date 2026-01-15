// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useMemo, useRef } from "react";

import { PropsVirtualizedTree } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import {
  COLLAPSED_ICON,
  DEFAULT_FONT_SIZE,
  EXPANDED_ICON,
  SCROLLL_OVERSCAN,
  TREE_NODE_INDENTATION,
} from "@lichtblick/suite-base/panels/RawMessagesVirtual/constants";

import { useStyles } from "./VirtualizedTree.style";
import { flattenTreeData } from "./flattenTreeData";

export const VirtualizedTree = memo(function VirtualizedTree({
  data,
  expandedNodes,
  onToggleExpand,
  fontSize,
  renderValue,
}: PropsVirtualizedTree) {
  const { classes } = useStyles();

  // eslint-disable-next-line no-restricted-syntax
  const parentRef = useRef<HTMLDivElement>(null);

  const flatData = useMemo(() => {
    return flattenTreeData(data, expandedNodes);
  }, [data, expandedNodes]);

  const getScrollElement = useCallback(() => parentRef.current, []);

  const virtualizer = useVirtualizer({
    count: flatData.length,
    getScrollElement,
    estimateSize: () => fontSize ?? DEFAULT_FONT_SIZE,
    overscan: SCROLLL_OVERSCAN,
    measureElement: (element) => element.getBoundingClientRect().height,
    // It helps prevent the "ResizeObserver loop completed with undelivered notifications" error
    // https://tanstack.com/virtual/latest/docs/api/virtualizer#useanimationframewithresizeobserver
    useAnimationFrameWithResizeObserver: true,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={classes.container} style={{ fontSize: fontSize ?? "inherit" }}>
      <div className={classes.innerWrapper} style={{ height: virtualizer.getTotalSize() }}>
        {items.map((virtualRow) => {
          const node = flatData[virtualRow.index];

          if (!node) {
            return undefined;
          }

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={classes.row}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                paddingLeft: node.depth * TREE_NODE_INDENTATION,
              }}
            >
              <span className={classes.expandButton}>
                {node.isExpandable && (
                  <button
                    onClick={() => {
                      onToggleExpand(node.key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleExpand(node.key);
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={expandedNodes.has(node.key)}
                    aria-label={`${expandedNodes.has(node.key) ? "Collapse" : "Expand"} ${node.label}`}
                    className={classes.spanButton}
                  >
                    {expandedNodes.has(node.key) ? COLLAPSED_ICON : EXPANDED_ICON}
                  </button>
                )}
              </span>
              <span className={classes.key}>{node.label}</span>
              <div className={classes.valueContainer}>{renderValue(node)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
