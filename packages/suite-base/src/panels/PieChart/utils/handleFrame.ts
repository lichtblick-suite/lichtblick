// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";

import type { PieChartState, PieChartAction } from "../types";

export type HandleFrameProps = {
  state: PieChartState;
  action: Extract<PieChartAction, { type: "frame" }>;
};

export function handleFrame({ state, action }: HandleFrameProps): PieChartState {
  if (state.pathParseError != undefined) {
    return { ...state, latestMessage: _.last(action.messages), error: undefined };
  }
  let latestMatchingQueriedData = state.latestMatchingQueriedData;
  let latestMessage = state.latestMessage;
  let error = state.error;

  if (state.parsedPath) {
    for (const message of action.messages) {
      if (message.topic !== state.parsedPath.topicName) {
        continue;
      }

      try {
        const extractedData = simpleGetMessagePathDataItems(message, state.parsedPath);

        if (extractedData.length === 0) {
          throw new Error("No data extracted from message path");
        }

        // Convert extracted data to numeric array
        let data: Float32Array | undefined;

        try {
          const numericData = extractedData.flat().map((item) => Number(item));
          if (numericData.length > 0 && !numericData.some(isNaN)) {
            data = new Float32Array(numericData);
          }
        } catch {
          // Keep data as undefined if conversion fails
        }

        latestMatchingQueriedData = data;
        latestMessage = message;
        error = undefined;
      } catch (err) {
        error = err instanceof Error ? err : new Error("Unknown error processing message data");
      }
    }
  }

  return { ...state, latestMessage, latestMatchingQueriedData, error };
}
