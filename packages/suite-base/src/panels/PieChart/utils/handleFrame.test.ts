// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PieChartBuilder from "@lichtblick/suite-base/testing/builders/PieChartBuilder";

import { stateReducer } from "./stateReducer";
import type { PieChartAction } from "../types";

describe("handleFrame", () => {
  it("returns early when pathParseError is set", () => {
    const initialState = PieChartBuilder.pieChartState({
      pathParseError: "Invalid path",
      latestMatchingQueriedData: undefined,
    });
    const action: PieChartAction = {
      type: "frame",
      messages: MessageEventBuilder.messageEvents(),
    };

    const newState = stateReducer(initialState, action);

    expect(newState.latestMessage).toEqual(action.messages[action.messages.length - 1]);
    expect(newState.latestMatchingQueriedData).toBeInstanceOf(Float32Array);
    expect(newState.error).toBeUndefined();
  });

  it("updates latestMessage and latestMatchingQueriedData when topic matches", () => {
    const initialState = PieChartBuilder.pieChartState({
      parsedPath: { topicName: "test", topicNameRepr: "test", messagePath: [] },
    });
    const [message] = MessageEventBuilder.messageEvents();
    if (!message) {
      throw new Error("No message returned from messageEvents()");
    }
    message.topic = "test";
    const action: PieChartAction = {
      type: "frame",
      messages: [message],
    };

    const newState = stateReducer(initialState, action);

    expect(newState.latestMessage).toEqual(_.last(action.messages));
    expect(newState.latestMatchingQueriedData).toBeUndefined();
    expect(newState.error).toBeUndefined();
  });

  it("does not update if topics do not match parsedPath.topicName", () => {
    const [initialMessage] = MessageEventBuilder.messageEvents();
    const [unrelatedMessage] = MessageEventBuilder.messageEvents();
    if (!initialMessage || !unrelatedMessage) {
      throw new Error("No message returned from messageEvents()");
    }
    initialMessage.topic = "target-topic";
    unrelatedMessage.topic = "unrelated-topic";
    const initialState = PieChartBuilder.pieChartState({
      parsedPath: { topicName: "target-topic", topicNameRepr: "target-topic", messagePath: [] },
      latestMessage: initialMessage,
      latestMatchingQueriedData: new Float32Array([5]),
    });
    const action: PieChartAction = {
      type: "frame",
      messages: [unrelatedMessage],
    };

    const newState = stateReducer(initialState, action);

    // unchanged
    expect(newState.latestMessage).toEqual(initialState.latestMessage);
    expect(newState.latestMatchingQueriedData).toEqual(initialState.latestMatchingQueriedData);
  });

  it("does not update if parsedPath is missing", () => {
    const initialState = PieChartBuilder.pieChartState({ parsedPath: undefined });
    const action: PieChartAction = {
      type: "frame",
      messages: MessageEventBuilder.messageEvents(),
    };

    const newState = stateReducer(initialState, action);

    // should fallback to last message but not update queried data
    expect(newState.latestMatchingQueriedData).toEqual(initialState.latestMatchingQueriedData);
    expect(newState.latestMessage).toEqual(initialState.latestMessage);
  });
});
