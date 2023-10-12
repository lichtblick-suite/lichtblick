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

import * as _ from "lodash-es";
import { useCallback, useMemo } from "react";

import { filterMap } from "@foxglove/den/collection";
import { useDeepMemo, useShallowMemo } from "@foxglove/hooks";
import { Immutable } from "@foxglove/studio";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import {
  enumValuesByDatatypeAndField,
  extractTypeFromStudioEnumAnnotation,
} from "@foxglove/studio-base/util/enums";

import { MessagePathStructureItem, MessagePathStructureItemMessage, RosPath } from "./constants";
import { filterMatches } from "./filterMatches";
import { TypicalFilterNames } from "./isTypicalFilterName";
import { messagePathStructures } from "./messagePathsForDatatype";
import parseRosPath, { quoteTopicNameIfNeeded } from "./parseRosPath";

type ValueInMapRecord<T> = T extends Map<unknown, infer I> ? I : never;

export type MessagePathDataItem = {
  value: unknown; // The actual value.
  path: string; // The path to get to this value. Tries to use "nice ids" like `[:]{some_id==123}` wherever possible.
  constantName?: string; // The name of the constant that the value matches up with, if any.
};

// Given a set of message paths, this returns a function that you can call to resolve a single path
// and message to an array of `MessagePathDataItem` objects. The array+objects will be the same by
// reference, as long as topics/datatypes/global variables haven't changed in the meantime.
export function useCachedGetMessagePathDataItems(
  paths: readonly string[],
): (path: string, message: MessageEvent) => MessagePathDataItem[] | undefined {
  const { topics: providerTopics, datatypes } = PanelAPI.useDataSourceInfo();
  const { globalVariables } = useGlobalVariables();
  const memoizedPaths = useShallowMemo(paths);

  const parsedPaths = useMemo(() => {
    return filterMap(memoizedPaths, (path) => {
      const rosPath = parseRosPath(path);
      return rosPath ? ([path, rosPath] satisfies [string, RosPath]) : undefined;
    });
  }, [memoizedPaths]);

  // We first fill in global variables in the paths, so we can later see which paths have really
  // changed when the global variables have changed.
  const unmemoizedFilledInPaths = useMemo(() => {
    const filledInPaths: Record<string, RosPath> = {};
    for (const [path, parsedPath] of parsedPaths) {
      filledInPaths[path] = fillInGlobalVariablesInPath(parsedPath, globalVariables);
    }
    return filledInPaths;
  }, [globalVariables, parsedPaths]);
  const memoizedFilledInPaths = useDeepMemo(unmemoizedFilledInPaths);

  const topicsByName = useMemo(() => _.keyBy(providerTopics, ({ name }) => name), [providerTopics]);

  // Filter down topics and datatypes to only the ones we need to process the requested paths, so
  // our result can be dependent on the relevant topics only. Without this, adding topics/datatypes
  // dynamically would result in panels clearing out when their message reducers change as a result
  // of the change in topics/datatypes identity from the player.
  const unmemoizedRelevantTopics = useMemo(() => {
    const seenNames = new Set<string>();
    const result: Topic[] = [];
    for (const [, parsedPath] of parsedPaths) {
      if (seenNames.has(parsedPath.topicName)) {
        continue;
      }
      seenNames.add(parsedPath.topicName);
      const topic = topicsByName[parsedPath.topicName];
      if (topic) {
        result.push(topic);
      }
    }
    return result;
  }, [topicsByName, parsedPaths]);
  const relevantTopics = useDeepMemo(unmemoizedRelevantTopics);

  const unmemoizedRelevantDatatypes = useMemo(() => {
    const relevantDatatypes = new Map<string, Immutable<ValueInMapRecord<RosDatatypes>>>();
    function addRelevantDatatype(datatypeName: string, seen: string[]) {
      if (seen.includes(datatypeName)) {
        return;
      }

      const type = datatypes.get(datatypeName);
      if (type) {
        relevantDatatypes.set(datatypeName, type);
        for (const field of type.definitions) {
          if (
            field.isComplex === true ||
            extractTypeFromStudioEnumAnnotation(field.name) != undefined
          ) {
            addRelevantDatatype(field.type, [...seen, datatypeName]);
          }
        }
      }
    }
    for (const { schemaName } of relevantTopics.values()) {
      if (schemaName != undefined) {
        addRelevantDatatype(schemaName, []);
      }
    }
    return relevantDatatypes;
  }, [datatypes, relevantTopics]);
  const relevantDatatypes = useDeepMemo(unmemoizedRelevantDatatypes);

  const structures = useMemo(() => messagePathStructures(relevantDatatypes), [relevantDatatypes]);

  const enumValues = useMemo(
    () => enumValuesByDatatypeAndField(relevantDatatypes),
    [relevantDatatypes],
  );

  return useCallback(
    (path: string, message: MessageEvent): MessagePathDataItem[] | undefined => {
      if (!memoizedPaths.includes(path)) {
        throw new Error(`path (${path}) was not in the list of cached paths`);
      }
      const filledInPath = memoizedFilledInPaths[path];
      if (!filledInPath) {
        return;
      }
      const messagePathDataItems = getMessagePathDataItems(
        message,
        filledInPath,
        topicsByName,
        structures,
        enumValues,
      );
      return messagePathDataItems;
    },
    [memoizedPaths, memoizedFilledInPaths, topicsByName, structures, enumValues],
  );
}

export function fillInGlobalVariablesInPath(
  rosPath: RosPath,
  globalVariables: GlobalVariables,
): RosPath {
  return {
    ...rosPath,
    messagePath: rosPath.messagePath.map((messagePathPart) => {
      if (messagePathPart.type === "slice") {
        const start =
          typeof messagePathPart.start === "object"
            ? Number(globalVariables[messagePathPart.start.variableName])
            : messagePathPart.start;
        const end =
          typeof messagePathPart.end === "object"
            ? Number(globalVariables[messagePathPart.end.variableName])
            : messagePathPart.end;

        return {
          ...messagePathPart,
          start: isNaN(start) ? 0 : start,
          end: isNaN(end) ? Infinity : end,
        };
      } else if (messagePathPart.type === "filter" && typeof messagePathPart.value === "object") {
        let value;
        const variable = globalVariables[messagePathPart.value.variableName];
        if (typeof variable === "number" || typeof variable === "string") {
          value = variable;
        }
        return { ...messagePathPart, value };
      }

      return messagePathPart;
    }),
  };
}

// Get a new item that has `queriedData` set to the values and paths as queried by `rosPath`.
// Exported for tests.
export function getMessagePathDataItems(
  message: MessageEvent,
  filledInPath: RosPath,
  topicsByName: Record<string, Topic>,
  structures: Record<string, MessagePathStructureItemMessage>,
  enumValues: ReturnType<typeof enumValuesByDatatypeAndField>,
): MessagePathDataItem[] | undefined {
  const topic = topicsByName[filledInPath.topicName];

  // We don't care about messages that don't match the topic we're looking for.
  if (!topic || message.topic !== filledInPath.topicName) {
    return;
  }

  // Apply top-level filters first. If a message matches all top-level filters, then this function
  // will *always* return a history item, so this is our only chance to return nothing.
  for (const item of filledInPath.messagePath) {
    if (item.type === "filter") {
      if (!filterMatches(item, message.message)) {
        return [];
      }
    } else {
      break;
    }
  }

  const queriedData: MessagePathDataItem[] = [];
  // Traverse the message (via `value`) and the `messagePath` at the same time. Also keep track
  // of a `path` string that we should show in the tooltip of the point.
  function traverse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    pathIndex: number,
    path: string,
    structureItem: MessagePathStructureItem | undefined,
  ) {
    if (value == undefined) {
      return;
    }
    const pathItem = filledInPath.messagePath[pathIndex];
    const nextPathItem = filledInPath.messagePath[pathIndex + 1];
    if (!pathItem) {
      // If we're at the end of the `messagePath`, we're done! Just store the point.
      let constantName: string | undefined;
      const prevPathItem = filledInPath.messagePath[pathIndex - 1];
      if (prevPathItem && prevPathItem.type === "name") {
        const fieldName = prevPathItem.name;
        const enumMap = structureItem != undefined ? enumValues[structureItem.datatype] : undefined;
        constantName = enumMap?.[fieldName]?.[value];
      }
      queriedData.push({ value, path, constantName });
    } else if (
      pathItem.type === "name" &&
      (structureItem == undefined || structureItem.structureType === "message")
    ) {
      // If the `pathItem` is a name, we're traversing down using that name.
      const next = structureItem?.nextByName[pathItem.name];
      traverse(value[pathItem.name], pathIndex + 1, `${path}.${pathItem.repr}`, next);
    } else if (
      pathItem.type === "slice" &&
      (structureItem == undefined || structureItem.structureType === "array")
    ) {
      const { start, end } = pathItem;
      if (typeof start === "object" || typeof end === "object") {
        throw new Error(
          "getMessagePathDataItems only works on paths where global variables have been filled in",
        );
      }
      const startIdx: number = start;
      const endIdx: number = end;
      if (typeof startIdx !== "number" || typeof endIdx !== "number") {
        return;
      }

      // If the `pathItem` is a slice, iterate over all the relevant elements in the array.
      const arrayLength = value.length as number;
      for (let i = startIdx; i <= Math.min(endIdx, arrayLength - 1); i++) {
        const index = i >= 0 ? i : arrayLength + i;
        const arrayElement = value[index];
        if (arrayElement == undefined) {
          continue;
        }
        // Ideally show something like `/topic.object[:]{some_id=123}` for the path, but fall
        // back to `/topic.object[10]` if necessary. In any case, make sure that the user can
        // actually identify where the value came from.
        let newPath;
        if (nextPathItem && nextPathItem.type === "filter") {
          // If we have a filter set after this, it will update the path appropriately.
          newPath = `${path}[:]`;
        } else if (typeof arrayElement === "object") {
          // See if `arrayElement` has a property that we typically filter on. If so, show that.
          const name = TypicalFilterNames.find((id) => id in arrayElement);
          if (name != undefined) {
            newPath = `${path}[:]{${name}==${arrayElement[name]}}`;
          } else {
            // Use `i` here instead of `index`, since it's only different when `i` is negative,
            // and in that case it's probably more useful to show to the user how many elements
            // from the end of the array this data is, since they clearly are thinking in that way
            // (otherwise they wouldn't have chosen a negative slice).
            newPath = `${path}[${i}]`;
          }
        } else {
          // Use `i` here instead of `index`, since it's only different when `i` is negative,
          // and in that case it's probably more useful to show to the user how many elements
          // from the end of the array this data is, since they clearly are thinking in that way
          // (otherwise they wouldn't have chosen a negative slice).
          newPath = `${path}[${i}]`;
        }
        traverse(arrayElement, pathIndex + 1, newPath, structureItem?.next);
      }
    } else if (pathItem.type === "filter") {
      if (filterMatches(pathItem, value)) {
        traverse(value, pathIndex + 1, `${path}{${pathItem.repr}}`, structureItem);
      }
    } else {
      console.warn(
        `Unknown pathItem.type ${pathItem.type} for structureType: ${structureItem?.structureType}`,
      );
    }
  }
  const structure: MessagePathStructureItemMessage | undefined =
    // If the topic has no schema, we can at least allow accessing the root message
    topic.schemaName == undefined
      ? { structureType: "message", datatype: "", nextByName: {} }
      : structures[topic.schemaName];
  if (structure) {
    traverse(message.message, 0, quoteTopicNameIfNeeded(filledInPath.topicName), structure);
  }
  return queriedData;
}

export type MessageAndData = {
  messageEvent: MessageEvent;
  queriedData: MessagePathDataItem[];
};

export type MessageDataItemsByPath = {
  readonly [key: string]: readonly MessageAndData[];
};

export function useDecodeMessagePathsForMessagesByTopic(
  paths: readonly string[],
): (messagesByTopic: { [topicName: string]: readonly MessageEvent[] }) => MessageDataItemsByPath {
  const memoizedPaths = useShallowMemo(paths);
  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems(memoizedPaths);
  // Note: Let callers define their own memoization scheme for messagesByTopic. For regular playback
  // useMemo might be appropriate, but weakMemo will likely better for blocks.
  return useCallback(
    (messagesByTopic) => {
      const obj: { [path: string]: MessageAndData[] } = {};
      for (const path of memoizedPaths) {
        // Create an array for invalid paths, and valid paths with entries in messagesByTopic
        const rosPath = parseRosPath(path);
        if (!rosPath) {
          obj[path] = [];
          continue;
        }
        const messages = messagesByTopic[rosPath.topicName];
        if (!messages) {
          // For the playback pipeline messagesByTopic will always include an entry for every topic.
          // For the blocks, missing entries are semantically interesting, and should result in
          // missing (not empty) entries in the output so that information is communicated
          // downstream.
          continue;
        }

        const messagesForThisPath: MessageAndData[] = [];
        obj[path] = messagesForThisPath;

        for (const message of messages) {
          // Add the item (if it exists) to the array.
          const queriedData = cachedGetMessagePathDataItems(path, message);
          if (queriedData) {
            messagesForThisPath.push({ messageEvent: message, queriedData });
          }
        }
      }
      return obj;
    },
    [memoizedPaths, cachedGetMessagePathDataItems],
  );
}
