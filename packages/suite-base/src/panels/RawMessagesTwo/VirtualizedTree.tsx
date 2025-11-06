// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useMemo, CSSProperties } from "react";

import { DATA_ARRAY_PREVIEW_LIMIT } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { useStylesVirtualizedTree } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import { PropsVirtualizedTree } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

import { flattenTreeData } from "./flattenTreeData";

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
  classes: ReturnType<typeof useStylesVirtualizedTree>["classes"],
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
}: PropsVirtualizedTree): React.JSX.Element {
  const { classes, cx } = useStylesVirtualizedTree();
  // eslint-disable-next-line no-restricted-syntax
  const parentRef = useRef<HTMLDivElement>(null);

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
                height: `${virtualRow.size}px`,
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
