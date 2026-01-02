// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import MockBroadcastChannel from "@lichtblick/suite-base/util/broadcast/MockBroadcastChannel";
import { BasicBuilder } from "@lichtblick/test-builders";

import BroadcastManager from "./BroadcastManager";
import { BROADCAST_CHANNEL_NAME } from "./constants";
import { BroadcastMessageEvent } from "./types";

(global as any).BroadcastChannel = MockBroadcastChannel;

const createMockMessage = (): BroadcastMessageEvent => {
  return {
    type: BasicBuilder.sample(["play", "pause", "seek", "playUntil"]),
    time: RosTimeBuilder.time(),
  } as BroadcastMessageEvent;
};

describe("BroadcastManager", () => {
  beforeEach(() => {
    (BroadcastManager as any).instance = undefined;
    BroadcastManager.setShouldSync({ shouldSync: true });
  });

  it("should create a BroadcastChannel with the correct name", () => {
    // GIVEN
    const instance = BroadcastManager.getInstance();

    // THEN
    expect((instance as any).channel.name).toBe(BROADCAST_CHANNEL_NAME);
  });

  it("should be a singleton", () => {
    // GIVEN
    const firstInstance = BroadcastManager.getInstance();
    const secondInstance = BroadcastManager.getInstance();

    // THEN
    expect(firstInstance).toBe(secondInstance);
  });

  it("should post messages to the BroadcastChannel", () => {
    // GIVEN
    const instance = BroadcastManager.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;

    // WHEN
    const testMessage = createMockMessage();
    instance.postMessage(testMessage);

    // THEN
    expect(mockChannel.postedMessages).toContain(testMessage);
  });

  it("should notify listeners when a message is received", () => {
    // GIVEN
    const instance = BroadcastManager.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;
    const receivedMessages: BroadcastMessageEvent[] = [];
    const listener = (message: BroadcastMessageEvent) => receivedMessages.push(message);
    instance.addListener(listener);

    // WHEN
    const incomingMessage = createMockMessage();
    mockChannel.simulateIncomingMessage(incomingMessage);

    // THEN
    expect(receivedMessages).toContain(incomingMessage);
  });

  it("should remove listeners properly", () => {
    // GIVEN
    const instance = BroadcastManager.getInstance();
    const mockChannel = (instance as any).channel as MockBroadcastChannel;
    const receivedMessages: BroadcastMessageEvent[] = [];
    const listener = (message: BroadcastMessageEvent) => receivedMessages.push(message);
    instance.addListener(listener);
    instance.removeListener(listener);

    // WHEN
    const incomingMessage = createMockMessage();
    mockChannel.simulateIncomingMessage(incomingMessage);

    // THEN
    expect(receivedMessages).not.toContain(incomingMessage);
  });

  it("should close the BroadcastChannel", () => {
    // GIVEN
    const instance = BroadcastManager.getInstance();
    const mockChannel = (instance as any).channel as MockBroadcastChannel;

    // WHEN
    instance.close();

    // THEN
    expect(mockChannel.isClosed).toBe(true);
  });

  it("should not post messages when shouldSync is false", () => {
    // GIVEN
    BroadcastManager.setShouldSync({ shouldSync: false });
    const instance = BroadcastManager.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;

    // WHEN
    const testMessage = createMockMessage();
    instance.postMessage(testMessage);

    // THEN
    expect(mockChannel.postedMessages).not.toContain(testMessage);
  });

  it("should post messages when shouldSync is true", () => {
    // GIVEN
    BroadcastManager.setShouldSync({ shouldSync: true });
    const instance = BroadcastManager.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;

    // WHEN
    const testMessage = createMockMessage();
    instance.postMessage(testMessage);

    // THEN
    expect(mockChannel.postedMessages).toContain(testMessage);
  });

  it("should not notify listeners when shouldSync is false", () => {
    // GIVEN
    BroadcastManager.setShouldSync({ shouldSync: false });
    const instance = BroadcastManager.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;
    const receivedMessages: BroadcastMessageEvent[] = [];
    const listener = (message: BroadcastMessageEvent) => receivedMessages.push(message);
    instance.addListener(listener);

    // WHEN
    const incomingMessage = createMockMessage();
    mockChannel.simulateIncomingMessage(incomingMessage);

    // THEN the listener should not be notified
    expect(receivedMessages).not.toContain(incomingMessage);
  });

  it("should notify listeners when shouldSync is true", () => {
    // GIVEN
    BroadcastManager.setShouldSync({ shouldSync: true });
    const instance = BroadcastManager.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;
    const receivedMessages: BroadcastMessageEvent[] = [];
    const listener = (message: BroadcastMessageEvent) => receivedMessages.push(message);
    instance.addListener(listener);

    // WHEN
    const incomingMessage = createMockMessage();
    mockChannel.simulateIncomingMessage(incomingMessage);

    // THEN
    expect(receivedMessages).toContain(incomingMessage);
  });
});
