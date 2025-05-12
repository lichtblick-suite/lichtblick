/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { Time } from "@lichtblick/suite";
import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import MockBroadcastChannel from "@lichtblick/suite-base/util/broadcast/MockBroadcastChannel";
import { BroadcastMessageEvent } from "@lichtblick/suite-base/util/broadcast/types";
import useBroadcast from "@lichtblick/suite-base/util/broadcast/useBroadcast";

import BroadcastLB from "./BroadcastLB";

jest.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", () => ({
  useWorkspaceStore: jest.fn(),
}));

describe("useBroadcast", () => {
  let play: jest.Mock;
  let pause: jest.Mock;
  let seek: jest.Mock;
  let playUntil: jest.Mock;

  const testTime: Time = RosTimeBuilder.time();

  const useWorkspaceStoreMock = useWorkspaceStore as jest.Mock;

  beforeAll(() => {
    // @ts-expect-error MockBroadcastChannel as a minimal implementation
    global.BroadcastChannel = MockBroadcastChannel;
  });

  beforeEach(() => {
    play = jest.fn();
    pause = jest.fn();
    seek = jest.fn();
    playUntil = jest.fn();

    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderUseBroadcast = () => {
    return renderHook(() => {
      useBroadcast({ play, pause, seek, playUntil });
    });
  };

  const emitMessage = (message: BroadcastMessageEvent) => {
    // @ts-expect-error internal access to private property, but for tests it should be fine.
    const listeners = Array.from(BroadcastLB.getInstance().listeners);
    for (const listener of listeners) {
      listener(message);
    }
  };

  it("should call play and seek on 'play' message", () => {
    renderUseBroadcast();
    emitMessage({ type: "play", time: testTime });
    expect(seek).toHaveBeenCalledWith(testTime);
    expect(play).toHaveBeenCalled();
  });

  it("should call pause and seek on 'pause' message", () => {
    renderUseBroadcast();
    emitMessage({ type: "pause", time: testTime });
    expect(pause).toHaveBeenCalled();
    expect(seek).toHaveBeenCalledWith(testTime);
  });

  it("should call only seek on 'seek' message", () => {
    renderUseBroadcast();
    emitMessage({ type: "seek", time: testTime });
    expect(seek).toHaveBeenCalledWith(testTime);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });

  it("should call playUntil on 'playUntil' message", () => {
    renderUseBroadcast();
    emitMessage({ type: "playUntil", time: testTime });
    expect(playUntil).toHaveBeenCalledWith(testTime);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
  });

  it("should not add listeners if syncInstances is false", () => {
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );

    const addListenerSpy = jest.spyOn(BroadcastLB.getInstance(), "addListener");
    const { unmount } = renderUseBroadcast();
    unmount();

    expect(addListenerSpy).not.toHaveBeenCalled();
  });

  it("should not call any functions if the functions are not defined", () => {
    renderHook(() => {
      useBroadcast({});
    });

    emitMessage({ type: "play", time: testTime });
    emitMessage({ type: "pause", time: testTime });
    emitMessage({ type: "seek", time: testTime });
    emitMessage({ type: "playUntil", time: testTime });

    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
    expect(playUntil).not.toHaveBeenCalled();
  });
});
