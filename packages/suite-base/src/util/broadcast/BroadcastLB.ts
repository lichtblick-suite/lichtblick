// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BROADCAST_CHANNEL_NAME } from "./constants";
import { BroadcastMessageEvent, ChannelListeners } from "./types";

export default class BroadcastLB {
  private static instance: BroadcastLB | undefined;

  private readonly channel: BroadcastChannel;
  private readonly listeners: ChannelListeners;

  private constructor() {
    this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    this.listeners = new Set();

    this.channel.onmessage = (event: MessageEvent<BroadcastMessageEvent>) => {
      for (const listener of this.listeners) {
        listener(event.data);
      }
    };
  }

  public postMessage(message: BroadcastMessageEvent): void {
    this.channel.postMessage(message);
  }

  public addListener(listener: (message: BroadcastMessageEvent) => void): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: (message: BroadcastMessageEvent) => void): void {
    this.listeners.delete(listener);
  }

  public close(): void {
    this.channel.close();
    BroadcastLB.instance = undefined;
  }

  public static getInstance(): BroadcastLB {
    BroadcastLB.instance ??= new BroadcastLB();
    return BroadcastLB.instance;
  }
}
