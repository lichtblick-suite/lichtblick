// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { Metadata, ParameterValue } from "@lichtblick/suite";
import { IteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { freezeMetadata } from "@lichtblick/suite-base/players/IterablePlayer/freezeMetadata";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import {
  PlayerStateActiveData,
  PlayerState,
  Player,
  SubscribePayload,
  AdvertiseOptions,
  PlayerPresence,
} from "@lichtblick/suite-base/players/types";

export default class FakePlayer implements Player {
  #listener?: (arg0: PlayerState) => Promise<void>;
  public playerId: string = "test";
  public subscriptions: SubscribePayload[] = [];
  public publishers: AdvertiseOptions[] | undefined;
  #capabilities: (typeof PLAYER_CAPABILITIES)[keyof typeof PLAYER_CAPABILITIES][] = [];
  #profile: string | undefined;

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.#listener = listener;
  }

  public async emit({
    activeData,
    presence,
    progress,
    playerId,
  }: {
    activeData?: PlayerStateActiveData;
    presence?: PlayerPresence;
    progress?: PlayerState["progress"];
    playerId?: string;
  } = {}): Promise<void> {
    if (!this.#listener) {
      return undefined;
    }

    await this.#listener({
      playerId: playerId ?? this.playerId,
      presence: presence ?? PlayerPresence.PRESENT,
      capabilities: this.#capabilities,
      profile: this.#profile,
      progress: progress ?? {},
      activeData,
    });
  }

  public getBatchIterator(
    _topic: string,
  ): AsyncIterableIterator<Readonly<IteratorResult>> | undefined {
    return undefined;
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
    capabilities: (typeof PLAYER_CAPABILITIES)[keyof typeof PLAYER_CAPABILITIES][],
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
  public getMetadata = (): readonly Metadata[] => {
    const metadata = [
      {
        name: "metadataFake",
        metadata: { key: "value" },
      },
    ];

    freezeMetadata(metadata);

    return metadata;
  };
}
