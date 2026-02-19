// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

/** @jest-environment jsdom */

import { PieChartAction } from "@lichtblick/suite-base/panels/PieChart/types";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PieChartBuilder from "@lichtblick/suite-base/testing/builders/PieChartBuilder";

import { stateReducer } from "./stateReducer";

describe("stateReducer", () => {
  it("handles 'path' action correctly", () => {
    const initialState = PieChartBuilder.pieChartState();
    const action: PieChartAction = { type: "path", path: "/example/path" };
    const newState = stateReducer(initialState, action);

    expect(newState.path).toBe("/example/path");
    expect(newState.parsedPath).toBeDefined();
  });

  it("handles 'seek' action correctly", () => {
    const [message] = MessageEventBuilder.messageEvents();
    if (!message) {
      throw new Error("No message returned from messageEvents()");
    }
    message.topic = "test-topic";
    const initialState = PieChartBuilder.pieChartState({
      latestMessage: message,
    });
    const action: PieChartAction = { type: "seek" };
    const newState = stateReducer(initialState, action);

    expect(newState.latestMessage).toBeUndefined();
    expect(newState.latestMatchingQueriedData).toBeUndefined();
    expect(newState.error).toBeUndefined();
  });

  it("handles 'frame' action correctly", () => {
    const initialState = PieChartBuilder.pieChartState({
      parsedPath: { topicName: "test-topic", topicNameRepr: "test-topic", messagePath: [] },
    });
    const action: PieChartAction = {
      type: "frame",
      messages: MessageEventBuilder.messageEvents(),
    };
    const newState = stateReducer(initialState, action);

    expect(newState.latestMessage).toBeUndefined();
    expect(newState.latestMatchingQueriedData).toBeDefined();
    expect(newState.error).toBeUndefined();
  });

  it("returns the same state for unknown action types", () => {
    const initialState = PieChartBuilder.pieChartState();
    const action: PieChartAction = { type: "unknown" } as unknown as PieChartAction;
    const newState = stateReducer(initialState, action);

    expect(newState).toEqual(initialState);
  });

  it("handles empty state gracefully", () => {
    const action: PieChartAction = { type: "seek" };
    // @ts-expect-error: intentionally testing undefined state
    const newState = stateReducer(undefined, action);

    expect(newState).toBeDefined();
  });
});
