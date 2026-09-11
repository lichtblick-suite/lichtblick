// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { parseMessagePath, MessagePath, MessagePathStructureItem } from "@lichtblick/message-path";
import { messagePathStructures } from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";

/**
 * Selector that reads the sorted topic list from the message pipeline, used to resolve a path's
 * root schema name.
 */
function selectSortedTopics(ctx: MessagePipelineContext) {
  return ctx.sortedTopics;
}

/**
 * Selector that reads the datatypes map from the message pipeline, used to classify a path's
 * terminal value as a primitive leaf.
 */
function selectDatatypes(ctx: MessagePipelineContext) {
  return ctx.datatypes;
}

/**
 * Classify a parsed message path against its schema structure and report whether it terminates at a
 * primitive value (a plottable leaf). Follows `name` parts into sub-messages and `slice` parts into
 * arrays, matching the classification used by the Topic List.
 *
 * Returns `undefined` when the structure cannot be resolved (e.g. datatypes not yet loaded, unknown
 * schema, or a path part that does not exist in the schema), so callers can decide how to handle an
 * unclassifiable path.
 */
function classifyLeaf(
  rootStructure: MessagePathStructureItem | undefined,
  parsed: MessagePath,
): boolean | undefined {
  if (!rootStructure) {
    return undefined;
  }
  let current: MessagePathStructureItem = rootStructure;
  for (const part of parsed.messagePath) {
    switch (part.type) {
      case "name": {
        if (current.structureType !== "message") {
          return undefined;
        }
        const next = current.nextByName[part.name];
        if (!next) {
          return undefined;
        }
        current = next;
        break;
      }
      case "slice": {
        if (current.structureType !== "array") {
          return undefined;
        }
        current = current.next;
        break;
      }
      case "filter":
        // Filters do not change the structure position.
        break;
    }
  }
  // A leaf is a primitive value, or an array whose element type is primitive.
  if (current.structureType === "primitive") {
    return true;
  }
  if (current.structureType === "array") {
    return current.next.structureType === "primitive";
  }
  return false;
}

/**
 * Build a {@link DraggedMessagePath} from a series' configured message path string (e.g. a Plot or
 * StateTransitions `path.value`). This allows a series to be used as a message-path drag source so
 * it can be dropped onto another timeseries panel.
 *
 * The returned `isTopic`/`isLeaf` flags mirror the classification used by the Topic List drag
 * sources so drop targets (Plot, State Transitions, 3D image mode) validate drops consistently:
 * - `isTopic` is true when the path references a whole topic with no field selector.
 * - `isLeaf` is true when the path terminates at a primitive value (or array of primitives),
 *   determined from the topic's schema structure. When the schema is unavailable (datatypes not yet
 *   loaded or unknown schema) we fall back to "has a field selector", which is the best available
 *   approximation and still correctly treats a bare topic as a non-leaf.
 *
 * Returns `undefined` when the value is empty or cannot be parsed, in which case the series should
 * not be draggable.
 */
export function useDraggedMessagePath(value: string | undefined): DraggedMessagePath | undefined {
  const topics = useMessagePipeline(selectSortedTopics);
  const datatypes = useMessagePipeline(selectDatatypes);

  return useMemo(() => {
    if (value == undefined || value.length === 0) {
      return undefined;
    }
    const parsed = parseMessagePath(value);
    if (!parsed) {
      return undefined;
    }

    // A path with no `name` parts references the whole topic (not a plottable leaf).
    const hasFieldSelector = parsed.messagePath.some((part) => part.type === "name");
    const topic = topics.find((t) => t.name === parsed.topicName);

    // Resolve the terminal value's structure to determine whether it is a primitive leaf. Falls
    // back to the field-selector heuristic when the schema structure cannot be resolved.
    let isLeaf = hasFieldSelector;
    if (hasFieldSelector && topic?.schemaName != undefined && datatypes.size > 0) {
      const rootStructure = messagePathStructures(datatypes)[topic.schemaName];
      const classified = classifyLeaf(rootStructure, parsed);
      if (classified != undefined) {
        isLeaf = classified;
      }
    }

    return {
      path: value,
      rootSchemaName: topic?.schemaName,
      isTopic: !hasFieldSelector,
      isLeaf,
      topicName: parsed.topicName,
    };
  }, [datatypes, topics, value]);
}
