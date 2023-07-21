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

import { ParameterValue } from "@foxglove/studio";
import {
  PlayerCapabilities,
  PlayerStateActiveData,
  PlayerState,
  Player,
  SubscribePayload,
  AdvertiseOptions,
  PlayerPresence,
} from "@foxglove/studio-base/players/types";

export default class FakePlayer implements Player {
  #listener?: (arg0: PlayerState) => Promise<void>;
  public playerId: string = "test";
  public subscriptions: SubscribePayload[] = [];
  public publishers: AdvertiseOptions[] | undefined;
  #capabilities: (typeof PlayerCapabilities)[keyof typeof PlayerCapabilities][] = [];
  #profile: string | undefined;

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.#listener = listener;
  }

  public async emit({
    activeData,
    presence,
    progress,
  }: {
    activeData?: PlayerStateActiveData;
    presence?: PlayerPresence;
    progress?: PlayerState["progress"];
  } = {}): Promise<void> {
    if (!this.#listener) {
      return undefined;
    }

    return await this.#listener({
      playerId: this.playerId,
      presence: presence ?? PlayerPresence.PRESENT,
      capabilities: this.#capabilities,
      profile: this.#profile,
      progress: progress ?? {},
      activeData,
    });
  }

  public close = (): void => {
    // no-op
  };
  public setPlaybackSpeed = (): void => {
    // no-op
  };
  public pausePlayback = (): void => {
    // no-op
  };
  public publish = (): void => {
    // no-op
  };
  public callService = async (): Promise<void> => {
    // no-op
  };
  public setPublishers = (pubs: AdvertiseOptions[]): void => {
    this.publishers = pubs;
  };
  public setParameter(_key: string, _value: ParameterValue): void {
    // no-op
  }
  public setSubscriptions = (subs: SubscribePayload[]): void => {
    this.subscriptions = subs;
  };
  public setCapabilities = (
    capabilities: (typeof PlayerCapabilities)[keyof typeof PlayerCapabilities][],
  ): void => {
    this.#capabilities = capabilities;
  };
  public setProfile = (profile: string | undefined): void => {
    this.#profile = profile;
  };
  public startPlayback = (): void => {
    // no-op
  };
  public seekPlayback = (): void => {
    // no-op
  };
  public setGlobalVariables = (): void => {
    // no-op
  };
}
