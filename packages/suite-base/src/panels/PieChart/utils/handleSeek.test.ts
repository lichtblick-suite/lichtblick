// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PieChartBuilder from "@lichtblick/suite-base/testing/builders/PieChartBuilder";

import { handleSeek } from "./handleSeek";

describe("handleSeek", () => {
  it("resets latestMessage, latestMatchingQueriedData, and error to undefined", () => {
    const [message] = MessageEventBuilder.messageEvents();
    if (!message) {
      throw new Error("No message returned from messageEvents()");
    }
    message.topic = "test-topic";
    const initialState = PieChartBuilder.pieChartState({
      latestMessage: message,
      error: new Error("Test error"),
    });

    const newState = handleSeek(initialState);

    expect(newState.latestMessage).toBeUndefined();
    expect(newState.latestMatchingQueriedData).toBeUndefined();
    expect(newState.error).toBeUndefined();
  });

  it("does not modify other state properties", () => {
    const initialState = PieChartBuilder.pieChartState({
      path: "/example/path",
      parsedPath: { topicName: "test-topic", topicNameRepr: "test-topic", messagePath: [] },
    });

    const newState = handleSeek(initialState);

    expect(newState.path).toEqual(initialState.path);
    expect(newState.parsedPath).toEqual(initialState.parsedPath);
  });
});
