// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import {
  PlayerCapabilities,
  PlayerStateActiveData,
  PlayerState,
  Player,
  SubscribePayload,
  AdvertisePayload,
  PlayerPresence,
} from "@foxglove-studio/app/players/types";

export default class FakePlayer implements Player {
  listener?: (arg0: PlayerState) => Promise<void>;
  playerId: string = "test";
  subscriptions: SubscribePayload[] = [];
  publishers: AdvertisePayload[] | undefined;
  _capabilities: typeof PlayerCapabilities[keyof typeof PlayerCapabilities][] = [];

  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.listener = listener;
  }

  emit({
    activeData,
    presence,
  }: {
    activeData?: PlayerStateActiveData;
    presence?: PlayerPresence;
  } = {}): Promise<void> {
    if (!this.listener) {
      return Promise.resolve();
    }

    return this.listener({
      playerId: this.playerId,
      presence: presence ?? PlayerPresence.PRESENT,
      capabilities: this._capabilities,
      progress: {},
      activeData,
    });
  }

  close = (): void => {
    // no-op
  };
  setPlaybackSpeed = (): void => {
    // no-op
  };
  pausePlayback = (): void => {
    // no-op
  };
  publish = (): void => {
    // no-op
  };
  setPublishers = (pubs: AdvertisePayload[]): void => {
    this.publishers = pubs;
  };
  setSubscriptions = (subs: SubscribePayload[]): void => {
    this.subscriptions = subs;
  };
  setCapabilities = (
    capabilities: typeof PlayerCapabilities[keyof typeof PlayerCapabilities][],
  ): void => {
    this._capabilities = capabilities;
  };
  startPlayback = (): void => {
    // no-op
  };
  seekPlayback = (): void => {
    // no-op
  };
  requestBackfill = (): void => {
    // no-op
  };
  setGlobalVariables = (): void => {
    // no-op
  };
}
