// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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
  let newPath;
  let pathParseError: string | undefined;
  let error: Error | undefined;

  try {
    newPath = parseMessagePath(action.path);
    if (
      newPath?.messagePath.some(
        (part) =>
          (part.type === "filter" && typeof part.value === "object") ||
          (part.type === "slice" &&
            (typeof part.start === "object" || typeof part.end === "object")),
      ) ??
      false
    ) {
      pathParseError = "Message paths using variables are not currently supported";
    }
  } catch (err: unknown) {
    error = err as Error;
    newPath = undefined;
  }

  let latestMatchingQueriedData: unknown;
  if (newPath && pathParseError == undefined && state.latestMessage) {
    try {
      latestMatchingQueriedData = simpleGetMessagePathDataItems(state.latestMessage, newPath);
    } catch (err: unknown) {
      error = err as Error;
    }
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
