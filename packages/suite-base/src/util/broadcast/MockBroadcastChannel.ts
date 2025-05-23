// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BROADCAST_CHANNEL_NAME } from "@lichtblick/suite-base/util/broadcast/constants";
import { BroadcastMessageEvent } from "@lichtblick/suite-base/util/broadcast/types";

// Mock implementation of BroadcastChannel
export default class MockBroadcastChannel {
  public name = BROADCAST_CHANNEL_NAME;
  public onmessage: ((event: MessageEvent) => void) | undefined;
  public postedMessages: BroadcastMessageEvent[] = [];
  public isClosed = false;

  public postMessage(message: BroadcastMessageEvent): void {
    this.postedMessages.push(message);
  }

  public close(): void {
    this.isClosed = true;
  }

  // Helper to simulate receiving a message
  public simulateIncomingMessage(message: BroadcastMessageEvent): void {
    this.onmessage?.({ data: message } as MessageEvent<BroadcastMessageEvent>);
  }
}
