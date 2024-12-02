// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import * as _ from "lodash-es";

import { parseMessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import {
  GaugeAndIndicatorState,
  GaugeAndIndicatorAction,
} from "@lichtblick/suite-base/panels/types";

export function getSingleDataItem(results: unknown[]): unknown {
  if (results.length <= 1) {
    return results[0];
  }
  throw new Error("Message path produced multiple results");
}

function handleFrameActionState({
  messages,
  state,
}: {
  messages: readonly MessageEvent[];
  state: GaugeAndIndicatorState;
}): GaugeAndIndicatorState {
  if (state.pathParseError != undefined) {
    return { ...state, latestMessage: _.last(messages), error: undefined };
  }
  if (!state.parsedPath) {
    return { ...state, error: undefined };
  }

  let latestMatchingQueriedData = state.latestMatchingQueriedData;
  let latestMessage = state.latestMessage;
  for (const message of messages) {
    if (message.topic !== state.parsedPath.topicName) {
      continue;
    }

    const data = getSingleDataItem(simpleGetMessagePathDataItems(message, state.parsedPath));
    if (data != undefined) {
      latestMatchingQueriedData = data;
      latestMessage = message;
    }
  }

  return { ...state, latestMessage, latestMatchingQueriedData, error: undefined };
}

function handlePathActionState({
  path,
  state,
}: {
  path: string;
  state: GaugeAndIndicatorState;
}): GaugeAndIndicatorState {
  const newPath = parseMessagePath(path);
  let pathParseError: string | undefined;
  if (
    newPath?.messagePath.some(
      (part) =>
        (part.type === "filter" && typeof part.value === "object") ||
        (part.type === "slice" && (typeof part.start === "object" || typeof part.end === "object")),
    ) === true
  ) {
    pathParseError = "Message paths using variables are not currently supported";
  }
  let latestMatchingQueriedData: unknown;
  let error: Error | undefined;
  try {
    latestMatchingQueriedData =
      newPath && pathParseError == undefined && state.latestMessage
        ? getSingleDataItem(simpleGetMessagePathDataItems(state.latestMessage, newPath))
        : undefined;
  } catch (err: unknown) {
    error = err as Error;
  }
  return {
    ...state,
    error,
    latestMatchingQueriedData,
    parsedPath: newPath,
    path,
    pathParseError,
  };
}

export function stateReducer(
  state: GaugeAndIndicatorState,
  action: GaugeAndIndicatorAction,
): GaugeAndIndicatorState {
  try {
    switch (action.type) {
      case "frame": {
        return handleFrameActionState({ state, messages: action.messages });
      }
      case "path": {
        return handlePathActionState({ state, path: action.path });
      }
      case "seek":
        return {
          ...state,
          latestMessage: undefined,
          latestMatchingQueriedData: undefined,
          error: undefined,
        };
    }
  } catch (error) {
    return { ...state, latestMatchingQueriedData: undefined, error };
  }
}
