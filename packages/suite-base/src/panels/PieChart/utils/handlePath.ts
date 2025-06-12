// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { parseMessagePath } from "@lichtblick/message-path";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";

import type { PieChartState, PieChartAction } from "../types";

export type HandlePathProps = {
  state: PieChartState;
  action: Extract<PieChartAction, { type: "path" }>;
};

export function handlePath({ state, action }: HandlePathProps): PieChartState {
  const newPath = parseMessagePath(action.path);
  let pathParseError: string | undefined;
  if (
    newPath?.messagePath.some(
      (part) =>
        (part.type === "filter" && typeof part.value === "object") ||
        (part.type === "slice" && (typeof part.start === "object" || typeof part.end === "object")),
    ) ??
    false
  ) {
    pathParseError = "Message paths using variables are not currently supported";
  }
  let latestMatchingQueriedData: unknown;
  let error: Error | undefined;
  try {
    latestMatchingQueriedData =
      newPath && pathParseError == undefined && state.latestMessage
        ? simpleGetMessagePathDataItems(state.latestMessage, newPath)
        : undefined;
  } catch (err: unknown) {
    error = err as Error;
  }
  return {
    ...state,
    path: action.path,
    parsedPath: newPath,
    latestMatchingQueriedData,
    error,
    pathParseError,
  };
}
