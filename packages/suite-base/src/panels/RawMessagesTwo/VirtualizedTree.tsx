// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useMemo, CSSProperties, useEffect } from "react";
import { makeStyles } from "tss-react/mui";

import { flattenTreeData, TreeNode } from "./flattenTreeData";
import { DATA_ARRAY_PREVIEW_LIMIT } from "./utils";

// Suppress benign ResizeObserver error
// This is a known issue with ResizeObserver when measurements happen too frequently
// See: https://github.com/WICG/resize-observer/issues/38
const suppressResizeObserverError = () => {
  const errorHandler = (event: ErrorEvent) => {
    if (
      event.message.includes("ResizeObserver loop") ||
      event.message.includes("ResizeObserver loop completed with undelivered notifications")
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  };
  window.addEventListener("error", errorHandler);
  return () => {
    window.removeEventListener("error", errorHandler);
  };
};

const useStyles = makeStyles()((theme) => ({
  container: {
    overflow: "auto",
    contain: "strict",
    height: "100%",
    width: "100%",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    padding: "2px 0",
    fontFamily: theme.typography.body1.fontFamily,
    fontFeatureSettings: `${theme.typography.fontFeatureSettings}, "zero"`,
    fontSize: "inherit",
    lineHeight: 1.4,
  },
  expandButton: {
    cursor: "pointer",
    userSelect: "none",
    minWidth: 12,
    marginRight: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  key: {
    color: theme.palette.primary.main,
    marginRight: theme.spacing(0.5),
  },
  colon: {
    marginRight: theme.spacing(0.5),
  },
  value: {
    color: theme.palette.text.primary,
  },
  string: {
    color: theme.palette.success.main,
  },
  number: {
    color: theme.palette.info.main,
  },
  boolean: {
    color: theme.palette.warning.main,
  },
  null: {
    color: theme.palette.text.disabled,
  },
  objectLabel: {
    color: theme.palette.text.secondary,
    fontStyle: "italic",
  },
}));

type VirtualizedTreeProps = {
  data: unknown;
  expandedNodes: Set<string>;
  onToggleExpand: (keyPath: string) => void;
  fontSize?: number;
  renderValue?: (node: TreeNode) => React.ReactNode;
};

function formatValue(value: unknown): string {
  if (value == undefined) {
    return String(value);
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (ArrayBuffer.isView(value)) {
    const array = value as Uint8Array;
    const itemPart = Array.from(array.slice(0, DATA_ARRAY_PREVIEW_LIMIT)).join(", ");
    const length = array.length;
    return `${value.constructor.name}(${length}) [${itemPart}${length >= DATA_ARRAY_PREVIEW_LIMIT ? ", …" : ""}]`;
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `Object {${keys.length} ${keys.length === 1 ? "key" : "keys"}}`;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

function getValueClassName(
  value: unknown,
  classes: ReturnType<typeof useStyles>["classes"],
): string {
  if (value == undefined) {
    return classes.null;
  }
  if (typeof value === "string") {
    return classes.string;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return classes.number;
  }
  if (typeof value === "boolean") {
    return classes.boolean;
  }
  if (typeof value === "object") {
    return classes.objectLabel;
  }
  return classes.value;
}

export function VirtualizedTree({
  data,
  expandedNodes,
  onToggleExpand,
  fontSize,
  renderValue,
}: VirtualizedTreeProps): React.JSX.Element {
  const { classes, cx } = useStyles();
  // eslint-disable-next-line no-restricted-syntax
  const parentRef = useRef<HTMLDivElement>(null);

  // Suppress ResizeObserver errors
  useEffect(() => {
    return suppressResizeObserverError();
  }, []);

  const flatData = useMemo(() => {
    return flattenTreeData(data, expandedNodes);
  }, [data, expandedNodes]);

  const virtualizer = useVirtualizer({
    count: flatData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 5,

    measureElement: undefined,
  });

  const items = virtualizer.getVirtualItems();

  const containerStyle: CSSProperties = {
    fontSize: fontSize ?? "inherit",
  };

  return (
    <div ref={parentRef} className={classes.container} style={containerStyle}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const node = flatData[virtualRow.index];
          if (!node) {
            return undefined;
          }

          const paddingLeft = node.depth * 16;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className={classes.row}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "24px",
                transform: `translateY(${virtualRow.start}px)`,
                paddingLeft,
              }}
            >
              <span className={classes.expandButton}>
                {node.isExpandable ? (
                  <span
                    onClick={() => {
                      onToggleExpand(node.key);
                    }}
                  >
                    {expandedNodes.has(node.key) ? "▼" : "▶"}
                  </span>
                ) : (
                  <span style={{ visibility: "hidden" }}>▶</span>
                )}
              </span>
              <span className={classes.key}>{node.label}</span>
              <span className={classes.colon}>:</span>
              {renderValue ? (
                renderValue(node)
              ) : (
                <span className={cx(classes.value, getValueClassName(node.value, classes))}>
                  {formatValue(node.value)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
