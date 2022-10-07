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

import { isEqual } from "lodash";
import { useCallback, useMemo, useRef } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import useChangeDetector from "@foxglove/studio-base/hooks/useChangeDetector";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import {
  enumValuesByDatatypeAndField,
  extractTypeFromStudioEnumAnnotation,
  getTopicsByTopicName,
} from "@foxglove/studio-base/util/selectors";

import { MessagePathStructureItem, RosPath } from "./constants";
import { filterMatches } from "./filterMatches";
import { TypicalFilterNames } from "./isTypicalFilterName";
import { messagePathStructures } from "./messagePathsForDatatype";
import parseRosPath, { quoteTopicNameIfNeeded } from "./parseRosPath";

export type MessagePathDataItem = {
  value: unknown; // The actual value.
  path: string; // The path to get to this value. Tries to use "nice ids" like `[:]{some_id==123}` wherever possible.
  constantName?: string; // The name of the constant that the value matches up with, if any.
};

// Given a set of message paths, this returns a function that you can call to resolve a single path
// and message to an array of `MessagePathDataItem` objects. The array+objects will be the same by
// reference, as long as topics/datatypes/global variables haven't changed in the meantime.
export function useCachedGetMessagePathDataItems(
  paths: string[],
): (path: string, message: MessageEvent<unknown>) => MessagePathDataItem[] | undefined {
  const { topics: providerTopics, datatypes } = PanelAPI.useDataSourceInfo();
  const { globalVariables } = useGlobalVariables();
  const memoizedPaths: string[] = useShallowMemo<string[]>(paths);

  // We first fill in global variables in the paths, so we can later see which paths have really
  // changed when the global variables have changed.
  const unmemoizedFilledInPaths: {
    [key: string]: RosPath;
  } = useMemo(() => {
    const filledInPaths: Record<string, RosPath> = {};
    for (const path of memoizedPaths) {
      const rosPath = parseRosPath(path);
      if (rosPath) {
        filledInPaths[path] = fillInGlobalVariablesInPath(rosPath, globalVariables);
      }
    }
    return filledInPaths;
  }, [globalVariables, memoizedPaths]);
  const memoizedFilledInPaths = useDeepMemo<{
    [key: string]: RosPath;
  }>(unmemoizedFilledInPaths);

  // Filter down topics and datatypes to only the ones we need to process the requested paths, so
  // our result can be dependent on the relevant topics only. Without this, adding topics/datatypes
  // dynamically would result in panels clearing out when their message reducers change as a result
  // of the change in topics/datatypes identity from the player.
  const unmemoizedRelevantTopics = useMemo(() => {
    const topicsByName = getTopicsByTopicName(providerTopics);
    const seenNames = new Set<string>();
    const result: Topic[] = [];
    for (const path of memoizedPaths) {
      const rosPath = parseRosPath(path);
      if (rosPath) {
        if (seenNames.has(rosPath.topicName)) {
          continue;
        }
        seenNames.add(rosPath.topicName);
        const topic = topicsByName[rosPath.topicName];
        if (topic) {
          result.push(topic);
        }
      }
    }
    return result;
  }, [providerTopics, memoizedPaths]);
  const relevantTopics = useDeepMemo(unmemoizedRelevantTopics);

  const unmemoizedRelevantDatatypes = useMemo(() => {
    const relevantDatatypes: RosDatatypes = new Map();
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
    for (const { schemaName: datatype } of relevantTopics.values()) {
      addRelevantDatatype(datatype, []);
    }
    return relevantDatatypes;
  }, [datatypes, relevantTopics]);
  const relevantDatatypes = useDeepMemo(unmemoizedRelevantDatatypes);

  // Cache MessagePathDataItem arrays by Message. We need to clear out this cache whenever
  // the topics or datatypes change, since that's what getMessagePathDataItems
  // depends on, outside of the message+path.
  const cachesByPath = useRef<{
    [key: string]: {
      filledInPath: RosPath;
      weakMap: WeakMap<MessageEvent<unknown>, MessagePathDataItem[] | undefined>;
    };
  }>({});
  if (useChangeDetector([relevantTopics, relevantDatatypes], { initiallyTrue: true })) {
    cachesByPath.current = {};
  }
  // When the filled in paths changed, then that means that either the path string changed, or a
  // relevant global variable changed. Delete the caches for where the `filledInPath` doesn't match
  // any more.
  if (useChangeDetector([memoizedFilledInPaths], { initiallyTrue: false })) {
    for (const [path, current] of Object.entries(cachesByPath.current)) {
      const filledInPath = memoizedFilledInPaths[path];
      if (!filledInPath || !isEqual(current.filledInPath, filledInPath)) {
        delete cachesByPath.current[path];
      }
    }
  }

  return useCallback(
    (path: string, message: MessageEvent<unknown>): MessagePathDataItem[] | undefined => {
      if (!memoizedPaths.includes(path)) {
        throw new Error(`path (${path}) was not in the list of cached paths`);
      }
      const filledInPath = memoizedFilledInPaths[path];
      if (!filledInPath) {
        return;
      }
      const currentPath = (cachesByPath.current[path] = cachesByPath.current[path] ?? {
        filledInPath,
        weakMap: new WeakMap(),
      });
      const { weakMap } = currentPath;
      if (!weakMap.has(message)) {
        const messagePathDataItems = getMessagePathDataItems(
          message,
          filledInPath,
          relevantTopics,
          relevantDatatypes,
        );
        weakMap.set(message, messagePathDataItems);
        return messagePathDataItems;
      }
      const messagePathDataItems = weakMap.get(message);
      return messagePathDataItems;
    },
    [relevantDatatypes, memoizedFilledInPaths, memoizedPaths, relevantTopics],
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
// Exported just for tests.
export function getMessagePathDataItems(
  message: MessageEvent<unknown>,
  filledInPath: RosPath,
  providerTopics: readonly Topic[],
  datatypes: RosDatatypes,
): MessagePathDataItem[] | undefined {
  const structures = messagePathStructures(datatypes);
  const topic = getTopicsByTopicName(providerTopics)[filledInPath.topicName];

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
    if (value == undefined || structureItem == undefined) {
      return;
    }
    const pathItem = filledInPath.messagePath[pathIndex];
    const nextPathItem = filledInPath.messagePath[pathIndex + 1];
    const structureIsJson =
      structureItem.structureType === "primitive" && structureItem.primitiveType === "json";
    if (!pathItem) {
      // If we're at the end of the `messagePath`, we're done! Just store the point.
      let constantName: string | undefined;
      const prevPathItem = filledInPath.messagePath[pathIndex - 1];
      if (prevPathItem && prevPathItem.type === "name") {
        const fieldName = prevPathItem.name;
        const enumMap = enumValuesByDatatypeAndField(datatypes)[structureItem.datatype];
        constantName = enumMap?.[fieldName]?.[value];
      }
      queriedData.push({ value, path, constantName });
    } else if (pathItem.type === "name" && structureItem.structureType === "message") {
      // If the `pathItem` is a name, we're traversing down using that name.
      const next = structureItem.nextByName[pathItem.name];
      const nextStructIsJson = next?.structureType === "primitive" && next.primitiveType === "json";

      const actualNext: MessagePathStructureItem =
        !nextStructIsJson && next
          ? next
          : { structureType: "primitive", primitiveType: "json", datatype: "" };
      traverse(value[pathItem.name], pathIndex + 1, `${path}.${pathItem.repr}`, actualNext);
    } else if (
      pathItem.type === "slice" &&
      (structureItem.structureType === "array" || structureIsJson)
    ) {
      const { start, end } = pathItem;
      if (typeof start === "object" || typeof end === "object") {
        throw new Error(
          "getMessagePathDataItems  only works on paths where global variables have been filled in",
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
        traverse(
          arrayElement,
          pathIndex + 1,
          newPath,
          !structureIsJson && structureItem.structureType === "array"
            ? structureItem.next
            : structureItem, // Structure is already JSON.
        );
      }
    } else if (pathItem.type === "filter") {
      if (filterMatches(pathItem, value)) {
        traverse(value, pathIndex + 1, `${path}{${pathItem.repr}}`, structureItem);
      }
    } else if (structureIsJson && pathItem.type === "name") {
      // Use getField just in case.
      traverse(value[pathItem.name], pathIndex + 1, `${path}.${pathItem.repr}`, {
        structureType: "primitive",
        primitiveType: "json",
        datatype: "",
      });
    } else {
      console.warn(
        `Unknown pathItem.type ${pathItem.type} for structureType: ${structureItem.structureType}`,
      );
    }
  }
  const structure = structures[topic.schemaName];
  if (structure) {
    traverse(message.message, 0, quoteTopicNameIfNeeded(filledInPath.topicName), structure);
  }
  return queriedData;
}

export type MessageAndData = {
  messageEvent: MessageEvent<unknown>;
  queriedData: MessagePathDataItem[];
};

export type MessageDataItemsByPath = {
  readonly [key: string]: readonly MessageAndData[];
};

export function useDecodeMessagePathsForMessagesByTopic(
  paths: string[],
): (messagesByTopic: {
  [topicName: string]: readonly MessageEvent<unknown>[];
}) => MessageDataItemsByPath {
  const memoizedPaths = useShallowMemo<string[]>(paths);
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
