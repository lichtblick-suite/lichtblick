// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlayerState, SubscribePayload } from "@lichtblick/suite-base/players/types";

/**
 * IStateProcessor interface describes operations to transform PlayerState and Subscriptions.
 */
export interface IStateProcessor {
  /**
   * Process a player state into a new player state.
   *
   * @param playerState the input player state
   * @param subs the latest subscriptions (for all topics including aliases)
   */
  process(playerState: PlayerState, subs: SubscribePayload[]): PlayerState;

  /**
   * Convert a set of subscriptions for all topics (including aliases) into subscriptions for only
   * the original topics.
   */
  aliasSubscriptions(subs: SubscribePayload[]): SubscribePayload[];
}
