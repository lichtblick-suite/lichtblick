// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

        // Handle different types of extracted data
        let data: Float32Array;

        // If we have a single item that's already a typed array, use it directly
        if (extractedData.length === 1) {
          const singleItem = extractedData[0];
          if (singleItem instanceof Float32Array) {
            data = singleItem;
          } else if (singleItem instanceof Float64Array) {
            data = new Float32Array(singleItem);
          } else if (Array.isArray(singleItem)) {
            const numericArray = singleItem.map((item) => Number(item));
            data = new Float32Array(numericArray);
          } else {
            // Single numeric value - wrap in array
            data = new Float32Array([Number(singleItem)]);
          }
        } else {
          // Multiple items (e.g., from array slice P[:]) - convert all to Float32Array
          const numericArray = extractedData.map((item) => Number(item));
          data = new Float32Array(numericArray);
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
