// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { MessagePath, MessagePathPart, parseMessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import {
  GaugeAndIndicatorState,
  GaugeAndIndicatorAction,
  FrameAction,
  PathAction,
  SeekAction,
} from "@lichtblick/suite-base/panels/shared/types";
import GlobalVariableBuilder from "@lichtblick/suite-base/testing/builders/GlobalVariableBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { stateReducer, getSingleDataItem } from "./gaugeAndIndicatorStateReducer";

jest.mock("@lichtblick/message-path", () => ({
  parseMessagePath: jest.fn(),
}));

jest.mock(
  "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems",
  () => ({
    simpleGetMessagePathDataItems: jest.fn(),
  }),
);

describe("getSingleDataItem", () => {
  it("should return the single item when the array has one element", () => {
    const items = BasicBuilder.numbers(1);

    const result = getSingleDataItem(items);

    expect(result).toBe(items[0]);
  });

  it("should throw an error when the array has multiple elements", () => {
    const items = BasicBuilder.numbers();

    expect(() => getSingleDataItem(items)).toThrow("Message path produced multiple results");
  });

  it("should return undefined when the array is empty", () => {
    const items: unknown[] = [];

    const result = getSingleDataItem(items);

    expect(result).toBeUndefined();
  });
});

describe("stateReducer", () => {
  function buildFrameAction({ messages }: { messages?: MessageEvent[] } = {}): FrameAction {
    return {
      type: "frame",
      messages: messages ?? MessageEventBuilder.messageEvents(),
    };
  }

  function buildPathAction(): PathAction {
    return {
      type: "path",
      path: BasicBuilder.string(),
    };
  }

  function buildSeekAction(): SeekAction {
    return {
      type: "seek",
    };
  }

  function buildMessagePath(messagePath: Partial<MessagePath> = {}): MessagePath {
    return {
      messagePath: [],
      modifier: undefined,
      topicName: BasicBuilder.string(),
      topicNameRepr: "",
      ...messagePath,
    };
  }

  function setup({
    stateOverride,
    actionOverride,
  }: {
    stateOverride?: Partial<GaugeAndIndicatorState>;
    actionOverride?: GaugeAndIndicatorAction;
  } = {}) {
    const state: GaugeAndIndicatorState = {
      error: undefined,
      globalVariables: undefined,
      latestMatchingQueriedData: undefined,
      latestMessage: undefined,
      parsedPath: buildMessagePath(),
      path: "",
      pathParseError: undefined,
      ...stateOverride,
    };

    const action: GaugeAndIndicatorAction =
      actionOverride ?? (buildFrameAction() as GaugeAndIndicatorAction);

    return {
      state,
      action,
    };
  }

  it("should return the state when throw an error", () => {
    const { state } = setup();

    const { pathParseError, error, latestMatchingQueriedData, latestMessage, parsedPath, path } =
      stateReducer(state, undefined as unknown as GaugeAndIndicatorAction);

    expect(error).not.toBeUndefined();
    expect(latestMatchingQueriedData).toBeUndefined();
    expect(latestMessage).toEqual(state.latestMessage);
    expect(parsedPath).toEqual(state.parsedPath);
    expect(path).toEqual(state.path);
    expect(pathParseError).toEqual(state.pathParseError);
  });

  describe("stateReducer when frame action", () => {
    it("should handle latestMessage and latestMatchingQueriedData", () => {
      const topicName = BasicBuilder.string();
      const { action, state } = setup({
        stateOverride: {
          parsedPath: buildMessagePath({
            topicName,
          }),
        },
        actionOverride: buildFrameAction({
          messages: [MessageEventBuilder.messageEvent({ topic: topicName })],
        }),
      });
      const frameAction = action as FrameAction;
      (simpleGetMessagePathDataItems as jest.Mock).mockReturnValue(frameAction.messages);

      const newState = stateReducer(state, action);

      expect(newState.latestMessage).toEqual(frameAction.messages[0]);
      expect(newState.latestMatchingQueriedData).toEqual(frameAction.messages[0]);
    });

    it("should handle latestMessage and latestMatchingQueriedData when single data is undefined", () => {
      const topicName = BasicBuilder.string();
      const { action, state } = setup({
        stateOverride: {
          parsedPath: buildMessagePath({
            topicName,
          }),
          latestMessage: MessageEventBuilder.messageEvent(),
          latestMatchingQueriedData: BasicBuilder.strings(),
        },
        actionOverride: buildFrameAction({
          messages: [MessageEventBuilder.messageEvent({ topic: topicName })],
        }),
      });
      (simpleGetMessagePathDataItems as jest.Mock).mockReturnValue([]);

      const newState = stateReducer(state, action);

      expect(newState.latestMessage).toEqual(state.latestMessage);
      expect(newState.latestMatchingQueriedData).toEqual(state.latestMatchingQueriedData);
    });

    it("should handle latestMessage and latestMatchingQueriedData when topic is not found", () => {
      const { action, state } = setup();
      (simpleGetMessagePathDataItems as jest.Mock).mockReturnValue([]);

      const newState = stateReducer(state, action);

      expect(newState).toEqual(state);
    });

    it("should handle latestMessage and latestMatchingQueriedData when parsedPath is undefined", () => {
      const { action, state } = setup({
        stateOverride: {
          parsedPath: undefined,
        },
      });

      const newState = stateReducer(state, action);

      expect(newState).toEqual(state);
    });

    it("should handle latestMessage when pathParseError is not undefined", () => {
      const { action, state } = setup({
        stateOverride: {
          pathParseError: BasicBuilder.string(),
        },
      });
      const frameAction = action as FrameAction;

      const newState = stateReducer(state, action);

      expect(newState.latestMessage).toEqual(frameAction.messages[frameAction.messages.length - 1]);
    });
  });

  describe("stateReducer when path action", () => {
    it("should parse the path and update state accordingly", () => {
      const { action, state } = setup({
        actionOverride: buildPathAction(),
      });
      const pathAction = action as PathAction;
      const newPath: MessagePath = {
        messagePath: [],
        topicName: pathAction.path,
        topicNameRepr: pathAction.path,
      };
      (parseMessagePath as jest.Mock).mockReturnValue(newPath);

      const newState = stateReducer(state, action);

      expect(parseMessagePath).toHaveBeenCalledWith(pathAction.path);
      expect(newState.path).toBe(pathAction.path);
      expect(newState.parsedPath).toMatchObject(newPath);
      expect(newState.error).toBeUndefined();
      expect(newState.pathParseError).toBeUndefined();
      expect(newState.latestMatchingQueriedData).toBeUndefined();
    });

    it("should parse the path and update latestMatchingQueriedData", () => {
      const { action, state } = setup({
        actionOverride: buildPathAction(),
        stateOverride: {
          latestMessage: MessageEventBuilder.messageEvent(),
        },
      });
      const pathAction = action as PathAction;
      const newPath: MessagePath = {
        messagePath: [{ type: "filter", value: BasicBuilder.number() } as MessagePathPart],
        topicName: "",
        topicNameRepr: "",
      };
      const expectedLatestMessage = MessageEventBuilder.messageEvent();
      (parseMessagePath as jest.Mock).mockReturnValue(newPath);
      (simpleGetMessagePathDataItems as jest.Mock).mockReturnValue([expectedLatestMessage]);

      const newState = stateReducer(state, action);

      expect(parseMessagePath).toHaveBeenCalledWith(pathAction.path);
      expect(simpleGetMessagePathDataItems).toHaveBeenCalledWith(state.latestMessage, newPath);
      expect(newState.path).toBe(pathAction.path);
      expect(newState.parsedPath).toMatchObject(newPath);
      expect(newState.error).toBeUndefined();
      expect(newState.pathParseError).toBeUndefined();
      expect(newState.latestMatchingQueriedData).toBe(expectedLatestMessage);
    });
  });

  describe("stateReducer when seek action", () => {
    it("should reset latestMessage and latestMatchingQueriedData", () => {
      const { action, state } = setup({
        actionOverride: buildSeekAction(),
      });

      const newState = stateReducer(state, action);

      expect(newState).toEqual(state);
      expect(newState.latestMessage).toBeUndefined();
      expect(newState.latestMatchingQueriedData).toBeUndefined();
      expect(newState.error).toBeUndefined();
    });
  });

  describe("stateReducer when updateGlobalVariables action", () => {
    it("should update globalVariables in the state", () => {
      const initialGlobalVariables = GlobalVariableBuilder.globalVariables();
      const newGlobalVariables = GlobalVariableBuilder.globalVariables();

      const { action, state } = setup({
        actionOverride: {
          type: "updateGlobalVariables",
          globalVariables: newGlobalVariables,
        },
        stateOverride: {
          globalVariables: initialGlobalVariables,
        },
      });

      const newState = stateReducer(state, action);

      expect(newState.globalVariables).toEqual(newGlobalVariables);
      expect(newState.error).toBe(state.error);
      expect(newState.latestMatchingQueriedData).toBe(state.latestMatchingQueriedData);
      expect(newState.latestMessage).toBe(state.latestMessage);
      expect(newState.parsedPath).toBe(state.parsedPath);
      expect(newState.path).toBe(state.path);
      expect(newState.pathParseError).toBe(state.pathParseError);
    });
  });
});
