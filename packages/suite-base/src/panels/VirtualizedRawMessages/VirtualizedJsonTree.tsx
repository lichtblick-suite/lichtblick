// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import React, { useCallback, useState } from "react";
import { FixedSizeTree } from "react-vtree";

import { DiffSpan } from "@lichtblick/suite-base/panels/RawMessages/DiffSpan";

type TreeNode = {
  id: string;
  name: string;
  value: unknown;
  nestingLevel: number;
  isLeaf: boolean;
  isOpenByDefault: boolean;
};

type VirtualizedJsonTreeProps = {
  data: unknown;
  fontSize?: number;
  renderValue: (label: string, value: unknown) => React.ReactNode;
  height?: number;
  width?: number;
};

export default function VirtualizedJsonTree({
  data,
  fontSize = 12,
  renderValue,
  height = 800,
  width = 800,
}: Readonly<VirtualizedJsonTreeProps>) {
  // Track open node IDs
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());

  // Toggle node open/closed
  const handleToggle = useCallback((id: string) => {
    setOpenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Tree walker that uses openNodes
  const treeWalker = useCallback(
    function* () {
      console.log("treewalker");
      function* walk(node: unknown, path: string, nestingLevel: number): Generator {
        const isObject = typeof node === "object" && node != undefined;
        const keys = isObject ? Object.keys(node as Record<string, unknown>) : [];
        const currentName = path === "" ? "(root)" : path.split(".").pop()!;
        const childPath = path ? `${path}.${key}` : key;
        const id = childPath;
        //const id = path || "(root)";
        const isLeaf = !isObject || keys.length === 0;
        const isOpen = openNodes.has(id) || nestingLevel < 2;

        yield {
          id,
          name: currentName,
          value: node,
          nestingLevel,
          isLeaf,
          isOpen,
          node,
          path,
        };

        if (isObject && isOpen) {
          const obj = node as Record<string, unknown>;
          for (const key of keys.slice(0, 1000)) {
            const child = obj[key];
            const childPath = path ? `${path}.${key}` : key;
            yield* walk(child, childPath, nestingLevel + 1);
          }
        }
      }
      yield* walk(data, "", 0);
    },
    [data, openNodes],
  );

  return (
    <FixedSizeTree<TreeNode> itemSize={20} height={height} width={width} treeWalker={treeWalker}>
      {({ data: nodeData, style }) => {
        const { nestingLevel, name, value, isLeaf, id } = nodeData;
        const isComplex = typeof value === "object" && value != undefined;
        console.log("NODE", nodeData);

        return (
          <div
            style={{
              ...style,
              paddingLeft: nestingLevel * 10,
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              fontSize,
              whiteSpace: "nowrap",
            }}
          >
            {!isLeaf && (
              <span
                onClick={() => {
                  handleToggle(id);
                }}
                style={{ cursor: "pointer", marginRight: 2 }}
              >
                {openNodes.has(id) || nestingLevel < 2 ? "▼" : "▶"}
              </span>
            )}
            <DiffSpan>
              {name}
              {!isComplex ? ":" : ""}
            </DiffSpan>
            {!isComplex && (
              // eslint-disable-next-line @typescript-eslint/no-base-to-string
              <span style={{ marginLeft: 8 }}>{renderValue(String(value), value)}</span>
            )}
          </div>
        );
      }}
    </FixedSizeTree>
  );
}
