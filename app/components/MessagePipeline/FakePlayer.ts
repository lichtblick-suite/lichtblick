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
} from "@foxglove-studio/app/players/types";

export default class FakePlayer implements Player {
  listener?: (arg0: PlayerState) => Promise<void>;
  playerId: string = "test";
  subscriptions: SubscribePayload[] = [];
  publishers: AdvertisePayload[] | null | undefined;
  _capabilities: typeof PlayerCapabilities[keyof typeof PlayerCapabilities][] = [];

  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.listener = listener;
  }

  emit(activeData?: PlayerStateActiveData): Promise<void> {
    if (!this.listener) {
      return Promise.resolve();
    }

    return this.listener({
      playerId: this.playerId,
      isPresent: true,
      showSpinner: false,
      showInitializing: false,
      capabilities: this._capabilities,
      progress: {},
      activeData,
    });
  }

  close() {
    // no-op
  }
  setPlaybackSpeed() {
    // no-op
  }
  pausePlayback() {
    // no-op
  }
  publish() {
    // no-op
  }
  setPublishers(pubs: AdvertisePayload[]) {
    this.publishers = pubs;
  }
  setSubscriptions(subs: SubscribePayload[]) {
    this.subscriptions = subs;
  }
  setCapabilities(capabilities: typeof PlayerCapabilities[keyof typeof PlayerCapabilities][]) {
    this._capabilities = capabilities;
  }
  startPlayback() {
    // no-op
  }
  seekPlayback() {
    // no-op
  }
  requestBackfill() {
    // no-op
  }
  setGlobalVariables() {
    // no-op
  }
}
