/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { Time } from "@lichtblick/suite";
import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import MockBroadcastChannel from "@lichtblick/suite-base/util/broadcast/MockBroadcastChannel";
import { BroadcastMessageEvent } from "@lichtblick/suite-base/util/broadcast/types";
import useBroadcast from "@lichtblick/suite-base/util/broadcast/useBroadcast";

import BroadcastManager from "./BroadcastManager";

jest.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", () => ({
  useWorkspaceStore: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppConfigurationValue: jest.fn(),
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
    const listeners = Array.from(BroadcastManager.getInstance().listeners);
    for (const listener of listeners) {
      listener(message);
    }
  };

  it("should call play and seek on 'play' message", () => {
    // GIVEN
    renderUseBroadcast();

    // WHEN
    emitMessage({ type: "play", time: testTime });

    // THEN
    expect(seek).toHaveBeenCalledWith(testTime);
    expect(play).toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(playUntil).not.toHaveBeenCalled();

    // seek should be called BEFORE play
    expect(seek.mock.invocationCallOrder[0]!).toBeLessThan(play.mock.invocationCallOrder[0]!);
  });

  it("should call pause and seek on 'pause' message", () => {
    // GIVEN
    renderUseBroadcast();

    // WHEN
    emitMessage({ type: "pause", time: testTime });

    // THEN
    expect(pause).toHaveBeenCalled();
    expect(seek).toHaveBeenCalledWith(testTime);
    expect(play).not.toHaveBeenCalled();
    expect(playUntil).not.toHaveBeenCalled();

    // seek should be called AFTER pause
    expect(seek.mock.invocationCallOrder[0]!).toBeGreaterThan(pause.mock.invocationCallOrder[0]!);
  });

  it("should call only seek on 'seek' message", () => {
    // GIVEN
    renderUseBroadcast();

    // WHEN
    emitMessage({ type: "seek", time: testTime });

    // THEN
    expect(seek).toHaveBeenCalledWith(testTime);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(playUntil).not.toHaveBeenCalled();
  });

  it("should call playUntil on 'playUntil' message", () => {
    // GIVEN
    renderUseBroadcast();

    // WHEN
    emitMessage({ type: "playUntil", time: testTime });

    // THEN
    expect(playUntil).toHaveBeenCalledWith(testTime);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
  });

  it("should add listeners, even if syncInstances is false", () => {
    // GIVEN
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );
    const addListenerSpy = jest.spyOn(BroadcastManager.getInstance(), "addListener");

    // WHEN
    const { unmount } = renderUseBroadcast();
    unmount();

    // THEN
    expect(addListenerSpy).toHaveBeenCalled();
  });

  it("should not call any functions if the functions are not defined", () => {
    // GIVEN
    renderHook(() => {
      useBroadcast({});
    });

    // WHEN
    emitMessage({ type: "play", time: testTime });
    emitMessage({ type: "pause", time: testTime });
    emitMessage({ type: "seek", time: testTime });
    emitMessage({ type: "playUntil", time: testTime });

    // THEN
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
    expect(playUntil).not.toHaveBeenCalled();
  });

  it("should call BroadcastManager.setShouldSync with the correct value when syncInstances changes", () => {
    // GIVEN
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );
    const setShouldSyncSpy = jest.spyOn(BroadcastManager, "setShouldSync");

    // WHEN
    const { rerender } = renderUseBroadcast();

    // THEN
    expect(setShouldSyncSpy).toHaveBeenCalledWith({ shouldSync: true });

    // WHEN
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );
    rerender();

    // THEN
    expect(setShouldSyncSpy).toHaveBeenCalledWith({ shouldSync: false });
  });
});
