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
        
        if (extractedData == undefined) {
          throw new Error('No data extracted from message path');
        }
        
        // Convert extracted data to Float32Array
        let data: Float32Array;
        if (extractedData instanceof Float32Array) {
          data = extractedData;
        } else if (extractedData instanceof Float64Array) {
          data = new Float32Array(extractedData);
        } else if (Array.isArray(extractedData)) {
          // Convert array to Float32Array, ensuring all elements are numbers
          const numericArray = extractedData.map((item) => Number(item));
          data = new Float32Array(numericArray);
        } else {
          throw new Error('Extracted data is not a Float32Array, Float64Array, or array');
        }
        
        latestMatchingQueriedData = data;
        latestMessage = message;
        error = undefined;
      } catch (err) {
        error = err instanceof Error ? err : new Error('Unknown error processing message data');
      }
    }
  }
  
  return { ...state, latestMessage, latestMatchingQueriedData, error };
}
