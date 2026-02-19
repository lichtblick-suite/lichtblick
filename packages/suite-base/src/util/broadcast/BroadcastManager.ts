// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BROADCAST_CHANNEL_NAME } from "./constants";
import { BroadcastMessageEvent, ChannelListeners } from "./types";

export default class BroadcastManager {
  private static instance: BroadcastManager | undefined;
  private static shouldSync = false;

  private readonly channel: BroadcastChannel;
  private readonly listeners: ChannelListeners;

  private constructor() {
    this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    this.listeners = new Set();

    this.channel.onmessage = (event: MessageEvent<BroadcastMessageEvent>) => {
      if (!BroadcastManager.shouldSync) {
        return;
      }
      for (const listener of this.listeners) {
        listener(event.data);
      }
    };
  }

  public postMessage(message: BroadcastMessageEvent): void {
    if (!BroadcastManager.shouldSync) {
      return;
    }
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
    BroadcastManager.instance = undefined;
  }

  public static getInstance(): BroadcastManager {
    BroadcastManager.instance ??= new BroadcastManager();
    return BroadcastManager.instance;
  }

  public static setShouldSync({ shouldSync }: { shouldSync: boolean }): void {
    BroadcastManager.shouldSync = shouldSync;
  }
}
