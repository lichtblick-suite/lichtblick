// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-base-to-string */

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { useCallback } from "react";
import { FixedSizeTree } from "react-vtree";

import { DiffSpan } from "./DiffSpan";

type TreeNode = {
  id: string;
  name: string;
  value: unknown;
  nestingLevel: number;
  isLeaf: boolean;
  isOpenByDefault: boolean;
};

function* jsonTreeWalker(
  refresh: boolean,
  props: { root?: unknown; maxInitialDepth?: number } = {},
): Generator<TreeNode> {
  const root = props.root ?? {};
  const maxInitialDepth = props.maxInitialDepth ?? 2;

  // Internal recursive walker
  function* walk(node: unknown, path: string, nestingLevel: number): Generator<TreeNode> {
    const isObject = typeof node === "object" && node != undefined;
    const keys = isObject ? Object.keys(node as Record<string, unknown>) : [];

    const currentName = path === "" ? "(root)" : path.split(".").pop()!;

    yield {
      id: path || "(root)",
      name: currentName,
      value: node,
      nestingLevel,
      isLeaf: !isObject || keys.length === 0,
      isOpenByDefault: nestingLevel < maxInitialDepth,
    };

    if (isObject) {
      const obj = node as Record<string, unknown>;
      for (const key of keys.slice(0, 1000)) {
        const child = obj[key];
        const childPath = path ? `${path}.${key}` : key;
        yield* walk(child, childPath, nestingLevel + 1);
      }
    }
  }

  yield* walk(root, "", 0);
}

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
}: VirtualizedJsonTreeProps) {
  const treeWalker = useCallback(
    (refresh: boolean) => jsonTreeWalker(refresh, { root: data }),
    [data],
  );

  return (
    <FixedSizeTree<TreeNode> itemSize={20} height={height} width={width} treeWalker={treeWalker}>
      {({ data: nodeData, isOpen, toggle, style }) => {
        const { nestingLevel, name, value, isLeaf } = nodeData;
        const isComplex = typeof value === "object" && value != undefined;

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
              <span onClick={toggle} style={{ cursor: "pointer", marginRight: 2 }}>
                {isOpen ? "▼" : "▶"}
              </span>
            )}
            <DiffSpan>
              {name}
              {!isComplex ? ":" : ""}
            </DiffSpan>
            {!isComplex && (
              <span style={{ marginLeft: 8 }}>{renderValue(String(value), value)}</span>
            )}
          </div>
        );
      }}
    </FixedSizeTree>
  );
}
