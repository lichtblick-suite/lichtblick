// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Stub implementation of UserScriptPlayer for production builds where UserScript features are disabled.
 * This prevents TypeScript from being bundled in production.
 */

import { Player, PlayerState, SubscribePayload } from "@lichtblick/suite-base/players/types";

class UserScriptPlayerStub implements Player {
  private _basePlayer: Player;

  public constructor(basePlayer: Player, ..._args: unknown[]) {
    this._basePlayer = basePlayer;
    console.warn("UserScriptPlayer features are disabled in this build");
  }

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    this._basePlayer.setListener(listener);
  }

  public close(): void {
    this._basePlayer.close();
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._basePlayer.setSubscriptions(subscriptions);
  }

  public setPublishers(_publishers: unknown): void {
    // No-op in stub
  }

  public setParameter(_key: string, _value: unknown): void {
    // No-op in stub
  }

  public publish(_payload: unknown): void {
    // No-op in stub
  }

  public async callService(_service: string, _request: unknown): Promise<unknown> {
    throw new Error("Service calls not supported in this build");
  }

  public setGlobalVariables(_globalVariables: unknown): void {
    // No-op in stub
  }

  public setUserScripts(_userScripts: unknown): void {
    // No-op in stub - UserScript features disabled
  }

  public startPlayback(): void {
    this._basePlayer.startPlayback?.();
  }

  public pausePlayback(): void {
    this._basePlayer.pausePlayback?.();
  }

  public seekPlayback(_time: unknown): void {
    this._basePlayer.seekPlayback?.(_time);
  }

  public setPlaybackSpeed(_speed: number): void {
    this._basePlayer.setPlaybackSpeed?.(_speed);
  }
}

export default UserScriptPlayerStub;
