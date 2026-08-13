// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { IteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import {
  AdvertiseOptions,
  Player,
  PlayerState,
  PublishPayload,
  SubscribePayload,
} from "@lichtblick/suite-base/players/types";

/**
 * Shared no-op/unimplemented Player method stubs common to all synthetic benchmark players.
 * Subclasses only need to implement `run()` and override whichever methods they actually use.
 */
abstract class BenchmarkPlayerBase implements Player {
  protected listener?: (state: PlayerState) => Promise<void>;

  protected abstract run(): Promise<void>;

  public setListener(listener: (state: PlayerState) => Promise<void>): void {
    this.listener = listener;
    void this.run();
  }

  public getBatchIterator(
    _topic: string,
  ): AsyncIterableIterator<Readonly<IteratorResult>> | undefined {
    return undefined;
  }
  public close(): void {
    // no-op
  }
  public setSubscriptions(_subscriptions: SubscribePayload[]): void {
    // no-op
  }
  public setPublishers(_publishers: AdvertiseOptions[]): void {
    // no-op
  }
  public setParameter(_key: string, _value: unknown): void {
    throw new Error("Method not implemented.");
  }
  public publish(_request: PublishPayload): void {
    throw new Error("Method not implemented.");
  }
  public async callService(_service: string, _request: unknown): Promise<unknown> {
    throw new Error("Method not implemented.");
  }
  public setGlobalVariables(_globalVariables: GlobalVariables): void {
    // no-op
  }
}

export { BenchmarkPlayerBase };
