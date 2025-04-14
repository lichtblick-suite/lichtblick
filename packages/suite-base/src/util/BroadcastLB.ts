// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export default class BroadcastLB {
  private static instance: BroadcastLB | undefined;

  private readonly channel: BroadcastChannel;
  private readonly listeners: Set<(message: unknown) => void>;

  private constructor(name: string) {
    this.channel = new BroadcastChannel(name);
    this.listeners = new Set();

    this.channel.onmessage = (event) => {
      for (const listener of this.listeners) {
        listener(event.data);
      }
    };
  }

  public postMessage(message: unknown): void {
    this.channel.postMessage(message);
  }

  public addListener(listener: (message: unknown) => void): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: (message: unknown) => void): void {
    this.listeners.delete(listener);
  }

  public close(): void {
    this.channel.close();
  }

  public static getInstance(): BroadcastLB {
    if (!BroadcastLB.instance) {
      BroadcastLB.instance = new BroadcastLB("player-lichtblick");
    }
    return BroadcastLB.instance;
  }
}
