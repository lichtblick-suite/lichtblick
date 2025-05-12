// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import MockBroadcastChannel from "@lichtblick/suite-base/util/broadcast/MockBroadcastChannel";

import BroadcastLB from "./BroadcastLB";
import { BROADCAST_CHANNEL_NAME } from "./constants";
import { BroadcastMessageEvent } from "./types";

// Replace global BroadcastChannel with the mock
(global as any).BroadcastChannel = MockBroadcastChannel;

const createMockMessage = (): BroadcastMessageEvent => {
  return {
    type: BasicBuilder.sample(["play", "pause", "seek", "playUntil"]),
    time: RosTimeBuilder.time(),
  } as BroadcastMessageEvent;
};

describe("BroadcastLB", () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    (BroadcastLB as any).instance = undefined;
  });

  it("should create a BroadcastChannel with the correct name", () => {
    const instance = BroadcastLB.getInstance();
    expect((instance as any).channel.name).toBe(BROADCAST_CHANNEL_NAME);
  });

  it("should be a singleton", () => {
    const firstInstance = BroadcastLB.getInstance();
    const secondInstance = BroadcastLB.getInstance();

    expect(firstInstance).toBe(secondInstance);
  });

  it("should post messages to the BroadcastChannel", () => {
    const instance = BroadcastLB.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;

    const testMessage = createMockMessage();
    instance.postMessage(testMessage);

    expect(mockChannel.postedMessages).toContain(testMessage);
  });

  it("should notify listeners when a message is received", () => {
    const instance = BroadcastLB.getInstance();
    const mockChannel: MockBroadcastChannel = (instance as any).channel;

    const receivedMessages: BroadcastMessageEvent[] = [];

    const listener = (message: BroadcastMessageEvent) => {
      receivedMessages.push(message);
    };

    instance.addListener(listener);

    const incomingMessage = createMockMessage();
    mockChannel.simulateIncomingMessage(incomingMessage);

    expect(receivedMessages).toContain(incomingMessage);
  });

  it("should remove listeners properly", () => {
    const instance = BroadcastLB.getInstance();
    const mockChannel = (instance as any).channel as MockBroadcastChannel;

    const receivedMessages: BroadcastMessageEvent[] = [];

    const listener = (message: BroadcastMessageEvent) => {
      receivedMessages.push(message);
    };

    instance.addListener(listener);
    instance.removeListener(listener);

    const incomingMessage = createMockMessage();
    mockChannel.simulateIncomingMessage(incomingMessage);

    expect(receivedMessages).not.toContain(incomingMessage);
  });

  it("should close the BroadcastChannel", () => {
    const instance = BroadcastLB.getInstance();
    const mockChannel = (instance as any).channel as MockBroadcastChannel;

    instance.close();

    expect(mockChannel.isClosed).toBe(true);
  });
});
