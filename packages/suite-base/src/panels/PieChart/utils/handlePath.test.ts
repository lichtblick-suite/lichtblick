// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { parseMessagePath } from "@lichtblick/message-path";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PieChartBuilder from "@lichtblick/suite-base/testing/builders/PieChartBuilder";

import { handlePath } from "./handlePath";
import type { PieChartAction } from "../types";

jest.mock("@lichtblick/message-path", () => ({
  parseMessagePath: jest.fn(),
}));

describe("handlePath", () => {
  it("parses the new path and updates the state", () => {
    const parsedPath = { topicName: "test-topic", topicNameRepr: "test-topic", messagePath: [] };
    (parseMessagePath as jest.Mock).mockReturnValue(parsedPath);

    const initialState = PieChartBuilder.pieChartState();
    const action: PieChartAction = { type: "path", path: "/new/path" };

    const newState = handlePath({ state: initialState, action });

    expect(newState.path).toBe("/new/path");
    expect(newState.parsedPath).toEqual(parsedPath);
    expect(newState.pathParseError).toBeUndefined();
  });
  it("sets pathParseError if the path contains variable filters or slices", () => {
    (parseMessagePath as jest.Mock).mockReturnValue({
      topicName: "test",
      topicNameRepr: "test",
      messagePath: [{ type: "filter", value: { var: "something" } }],
    });

    const initialState = PieChartBuilder.pieChartState();
    const action: PieChartAction = { type: "path", path: "/test/filter" };

    const newState = handlePath({ state: initialState, action });

    expect(newState.path).toBe("/test/filter");
    expect(newState.parsedPath).not.toBeNull();
    expect(newState.pathParseError).toBe(
      "Message paths using variables are not currently supported",
    );
  });

  it("handles errors during path parsing", () => {
    (parseMessagePath as jest.Mock).mockImplementation(() => {
      throw new Error("Parsing error");
    });

    const initialState = PieChartBuilder.pieChartState();
    const action: PieChartAction = { type: "path", path: "/error/path" };

    const newState = handlePath({ state: initialState, action });

    expect(newState.path).toBe("/error/path");
    expect(newState.parsedPath).toBeUndefined();
    expect(newState.error).toBeInstanceOf(Error);
    expect(newState.error?.message).toBe("Parsing error");
  });

  it("does not modify unrelated state properties", () => {
    const [message] = MessageEventBuilder.messageEvents();
    if (!message) {
      throw new Error("No message returned from messageEvents()");
    }
    message.topic = "test-topic";
    const initialState = PieChartBuilder.pieChartState({
      latestMessage: message,
    });
    const action: PieChartAction = { type: "path", path: "/new/path" };

    const newState = handlePath({ state: initialState, action });

    expect(newState.latestMessage).toEqual(initialState.latestMessage);
  });
});
