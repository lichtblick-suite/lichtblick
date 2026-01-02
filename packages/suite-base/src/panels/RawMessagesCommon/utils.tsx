// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { foxgloveMessageSchemas } from "@foxglove/schemas/internal";
import CheckIcon from "@mui/icons-material/Check";
import CopyAllIcon from "@mui/icons-material/CopyAll";
import FilterIcon from "@mui/icons-material/FilterAlt";
import StateTransitionsIcon from "@mui/icons-material/PowerInput";
import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";
import LineChartIcon from "@mui/icons-material/ShowChart";
import * as _ from "lodash-es";

import { MessagePathStructureItem, PrimitiveType } from "@lichtblick/message-path";
import { MessagePathDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  DATA_ARRAY_PREVIEW_LIMIT,
  PATH_NAME_AGGREGATOR,
  ROS1_COMMON_MSG_PACKAGES,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { copyMessageReplacer } from "@lichtblick/suite-base/panels/RawMessagesCommon/copyMessageReplacer";
import {
  diffLabels,
  DiffObject,
  NodeExpansion,
  NodeState,
  ValueActionItem,
  ValueLabels,
  ValueLabelsProps,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

ROS1_COMMON_MSG_PACKAGES.add("turtlesim");

function isTypedArray(obj: unknown): boolean {
  const isTyped =
    obj != undefined &&
    typeof obj === "object" &&
    ArrayBuffer.isView(obj) &&
    !(obj instanceof DataView);
  return isTyped;
}

function invert(value: NodeState): NodeState {
  return value === NodeState.Expanded ? NodeState.Collapsed : NodeState.Expanded;
}

/*
 * Calculate the new expansion state after toggling the node at `path`.
 */
export function toggleExpansion(
  state: NodeExpansion,
  paths: Set<string>,
  key: string,
): NodeExpansion {
  if (state === "all" || state === "none") {
    const next = state === "all" ? NodeState.Expanded : NodeState.Collapsed;
    const nextState: NodeExpansion = {};
    for (const leaf of paths) {
      // Implicitly all descendents are collapsed
      if (next === NodeState.Collapsed && leaf.startsWith(key + PATH_NAME_AGGREGATOR)) {
        continue;
      }
      nextState[leaf] = leaf === key ? invert(next) : next;
    }
    return nextState;
  }

  const prev = state[key];
  const next = prev == undefined ? NodeState.Collapsed : invert(prev);
  return {
    ...state,
    [key]: next,
  };
}

/**
 * Recursively traverses all keypaths in obj, for use in JSON tree expansion.
 */
export function generateDeepKeyPaths(obj: unknown): Set<string> {
  const keys = new Set<string>();
  const recurseMapKeys = (path: string[], nestedObj: unknown) => {
    if (nestedObj == undefined) {
      return;
    }

    if (typeof nestedObj !== "object" && typeof nestedObj !== "function") {
      return;
    }

    if (isTypedArray(nestedObj)) {
      return;
    }

    if (path.length > 0) {
      keys.add(path.join(PATH_NAME_AGGREGATOR));
    }

    for (const key of Object.getOwnPropertyNames(nestedObj)) {
      const newPath = [key, ...path];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (nestedObj as any)[key];
      recurseMapKeys(newPath, value as object);
    }
  };
  recurseMapKeys([], obj);
  return keys;
}

export function getChangeCounts(
  data: DiffObject,
  startingCounts: {
    -readonly [K in (typeof diffLabels)["ADDED" | "CHANGED" | "DELETED"]["labelText"]]: number;
  },
): {
  [key: string]: number;
} {
  for (const key in data) {
    if (
      key === diffLabels.ADDED.labelText ||
      key === diffLabels.CHANGED.labelText ||
      key === diffLabels.DELETED.labelText
    ) {
      startingCounts[key]++;
    } else if (typeof data[key] === "object" && data[key] != undefined) {
      getChangeCounts(data[key] as DiffObject, startingCounts);
    }
  }
  return startingCounts;
}

const foxgloveDocsLinksByDatatype = new Map<string, string>();
for (const schema of Object.values(foxgloveMessageSchemas)) {
  const url = `https://docs.foxglove.dev/docs/visualization/message-schemas/${_.kebabCase(
    schema.name,
  )}`;
  foxgloveDocsLinksByDatatype.set(`foxglove_msgs/${schema.name}`, url);
  foxgloveDocsLinksByDatatype.set(`foxglove_msgs/msg/${schema.name}`, url);
  foxgloveDocsLinksByDatatype.set(`foxglove.${schema.name}`, url);
}

export function getMessageDocumentationLink(datatype: string): string | undefined {
  const parts = datatype.split(/[/.]/);
  const pkg = _.first(parts);
  const filename = _.last(parts);

  if (pkg != undefined && ROS1_COMMON_MSG_PACKAGES.has(pkg)) {
    return `https://docs.ros.org/api/${pkg}/html/msg/${filename}.html`;
  }

  const foxgloveDocsLink = foxgloveDocsLinksByDatatype.get(datatype);
  if (foxgloveDocsLink != undefined) {
    return foxgloveDocsLink;
  }

  return undefined;
}

export function getConstantNameByKeyPath(
  keyPath: (string | number)[],
  queriedData: MessagePathDataItem[],
): string | undefined {
  if (keyPath.length > 0 && typeof keyPath[0] === "number") {
    return queriedData[keyPath[0]]?.constantName;
  }

  return undefined;
}

export const isSingleElemArray = (obj: unknown): obj is unknown[] => {
  if (!Array.isArray(obj)) {
    return false;
  }
  return obj.filter((a) => a != undefined).length === 1;
};

export const dataWithoutWrappingArray = (data: unknown): unknown => {
  return isSingleElemArray(data) && typeof data[0] === "object" ? data[0] : data;
};

export const getSingleValue = (data: unknown, queriedData: MessagePathDataItem[]): unknown => {
  if (!isSingleElemArray(data)) {
    return data;
  }

  if (queriedData[0]?.constantName == undefined) {
    return data[0];
  }

  return `${data[0]} (${queriedData[0].constantName})`;
};

/**
 * Gets formatted labels for displaying values in the raw messages panel.
 * Handles special formatting for bigint, ArrayBuffer views, and nsec fields.
 */
export function getValueLabels({
  constantName,
  label,
  itemValue,
  keyPath,
}: ValueLabelsProps): ValueLabels {
  let itemLabel = label;
  let arrLabel = "";

  // Handle bigint values
  if (typeof itemValue === "bigint") {
    itemLabel = itemValue.toString();
  }

  // Handle typed arrays (binary data preview)
  // Example: Int8Array(331776) [-4, -4, -4, -4, ..., -4]
  if (ArrayBuffer.isView(itemValue) && !(itemValue instanceof DataView)) {
    const array = itemValue as Uint8Array;
    const previewItems = Array.from(array.slice(0, DATA_ARRAY_PREVIEW_LIMIT));
    const hasMore = array.length > DATA_ARRAY_PREVIEW_LIMIT;

    arrLabel = `(${array.length}) [${previewItems.join(", ")}${hasMore ? ", …" : ""}] `;
    itemLabel = itemValue.constructor.name;
  }

  // Append constant name if available
  if (constantName != undefined) {
    itemLabel = `${itemLabel} (${constantName})`;
  }

  // Pad nanosecond fields to 9 digits for better readability
  // Example: 99999999 → 099999999 (makes it clearer this is 0.09 seconds)
  if (keyPath[0] === "nsec" && typeof itemValue === "number" && typeof itemLabel === "string") {
    itemLabel = itemLabel.padStart(9, "0");
  }

  return { arrLabel, itemLabel };
}

/**
 * Generate a string representation of the value for the label
 * @param value
 * @returns string
 */
export const getValueString = (value: unknown): string => {
  if (value == undefined) {
    return String(value);
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return "";
};

/** Value.tsx */

export const getCopyAction = (
  { copied }: { copied: boolean },
  itemValue: unknown,
  handleCopy: (value: string) => void,
): ValueActionItem => {
  return {
    key: "Copy",
    activeColor: copied ? "success" : "primary",
    tooltip: copied ? "Copied" : "Copy to Clipboard",
    icon: copied ? <CheckIcon fontSize="inherit" /> : <CopyAllIcon fontSize="inherit" />,
    onClick: () => {
      handleCopy(JSON.stringify(itemValue, copyMessageReplacer, 2) ?? "");
    },
  };
};

export const getFilterAction = (onFilter: () => void): ValueActionItem => {
  return {
    key: "Filter",
    tooltip: "Filter on this value",
    icon: <FilterIcon fontSize="inherit" />,
    onClick: onFilter,
  };
};

export const getLineChartAction = (
  singleSlicePath: string,
  openPlotPanel: (pathSuffix: string) => () => void,
): ValueActionItem => {
  return {
    key: "line",
    tooltip: "Plot this value on a line chart",
    icon: <LineChartIcon fontSize="inherit" />,
    onClick: openPlotPanel(singleSlicePath),
  };
};

export const getScatterPlotAction = (
  multiSlicePath: string,
  openPlotPanel: (pathSuffix: string) => () => void,
): ValueActionItem => {
  return {
    key: "scatter",
    tooltip: "Plot this value on a scatter plot",
    icon: <ScatterPlotIcon fontSize="inherit" />,
    onClick: openPlotPanel(multiSlicePath),
  };
};

export const getStateTransitionsAction = (
  singleSlicePath: string,
  openStateTransitionsPanel: (pathSuffix: string) => () => void,
): ValueActionItem => {
  return {
    key: "stateTransitions",
    tooltip: "View state transitions for this value",
    icon: <StateTransitionsIcon fontSize="inherit" />,
    onClick: openStateTransitionsPanel(singleSlicePath),
  };
};

/** getValueActionsForValue */
export const deducePrimitiveType = (value: unknown): PrimitiveType | undefined => {
  switch (typeof value) {
    case "bigint":
      return "int64";
    case "boolean":
      return "bool";
    case "number":
      return "int32"; // compatible with both Plot and State Transitions
    case "string":
      return "string";
    default:
      return undefined;
  }
};

export const isObjectElement = (
  value: unknown,
  pathItem: string | number,
  structureItem: MessagePathStructureItem | undefined,
): boolean => {
  return (
    typeof pathItem === "string" &&
    (structureItem == undefined || structureItem.structureType === "message") &&
    typeof value === "object"
  );
};

export const isArrayElement = (
  value: unknown,
  pathItem: string | number,
  structureItem: MessagePathStructureItem | undefined,
): boolean =>
  typeof pathItem === "number" &&
  (structureItem == undefined || structureItem.structureType === "array") &&
  Array.isArray(value);

export const formatValueForFilter = (value: unknown): string => {
  return typeof value === "bigint" ? value.toString() : (JSON.stringify(value) ?? "");
};
