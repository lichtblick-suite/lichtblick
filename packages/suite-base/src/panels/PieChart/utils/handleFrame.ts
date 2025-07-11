// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

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
  if (state.parsedPath) {
    for (const message of action.messages) {
      if (message.topic !== state.parsedPath.topicName) {
        continue;
      }
      const data = (message.message as { data: Float32Array }).data;
      latestMatchingQueriedData = data;
      latestMessage = message;
    }
  }
  return { ...state, latestMessage, latestMatchingQueriedData, error: undefined };
}
