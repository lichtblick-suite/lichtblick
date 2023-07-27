// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/rostime";
import { Immutable, ParameterValue } from "@foxglove/studio";
import { Asset } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  Player,
  PlayerState,
  PublishPayload,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";

import {
  AliasingInputs,
  TopicAliasFunctions,
  aliasPlayerState,
  aliasSubscriptions,
} from "./aliasing";

/**
 * This is a player that wraps an underlying player and applies aliases to all topic names
 * in data emitted from the player. It is inserted into the player chain before
 * UserNodePlayer so that UserNodePlayer can use the aliased topics.
 *
 * Aliases that alias input topics to other input topics or that request conflicting
 * aliases from multiple input topics to the same output topic are disallowed and flagged
 * as player problems
 */
export class TopicAliasingPlayer implements Player {
  readonly #player: Player;

  #inputs: Immutable<AliasingInputs>;
  #pendingSubscriptions: undefined | SubscribePayload[];
  #subscriptions: SubscribePayload[] = [];

  // True if no aliases are active and we can pass calls directly through to the
  // underlying player.
  #skipAliasing: boolean;

  #listener?: (state: PlayerState) => Promise<void>;

  public constructor(
    player: Player,
    aliasFunctions: Immutable<TopicAliasFunctions>,
    variables: Immutable<GlobalVariables>,
  ) {
    this.#player = player;
    this.#skipAliasing = aliasFunctions.length === 0;
    this.#inputs = {
      aliasFunctions,
      topics: undefined,
      variables,
    };
  }

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    this.#listener = listener;

    this.#player.setListener(async (state) => await this.#onPlayerState(state));
  }

  public setAliasFunctions(aliasFunctions: Immutable<TopicAliasFunctions>): void {
    this.#inputs = { ...this.#inputs, aliasFunctions };
    this.#skipAliasing = aliasFunctions.length === 0;
  }

  public close(): void {
    this.#player.close();
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.#subscriptions = subscriptions;

    if (this.#skipAliasing) {
      this.#player.setSubscriptions(subscriptions);
    } else {
      // If we have aliases but haven't recieved a topic list from an active state from
      // the wrapped player yet we have to delay setSubscriptions until we have the topic
      // list to set up the aliases.
      if (this.#inputs.topics != undefined) {
        const aliasedSubscriptions = aliasSubscriptions(this.#inputs, subscriptions);
        this.#player.setSubscriptions(aliasedSubscriptions);
        this.#pendingSubscriptions = undefined;
      } else {
        this.#pendingSubscriptions = subscriptions;
      }
    }
  }

  public setPublishers(publishers: AdvertiseOptions[]): void {
    this.#player.setPublishers(publishers);
  }

  public setParameter(key: string, value: ParameterValue): void {
    this.#player.setParameter(key, value);
  }

  public publish(request: PublishPayload): void {
    this.#player.publish(request);
  }

  public async callService(service: string, request: unknown): Promise<unknown> {
    return await this.#player.callService(service, request);
  }

  public startPlayback?(): void {
    this.#player.startPlayback?.();
  }

  public pausePlayback?(): void {
    this.#player.pausePlayback?.();
  }

  public seekPlayback?(time: Time): void {
    this.#player.seekPlayback?.(time);
  }

  public playUntil?(time: Time): void {
    if (this.#player.playUntil) {
      this.#player.playUntil(time);
      return;
    }
    this.#player.seekPlayback?.(time);
  }

  public setPlaybackSpeed?(speedFraction: number): void {
    this.#player.setPlaybackSpeed?.(speedFraction);
  }

  public setGlobalVariables(globalVariables: GlobalVariables): void {
    this.#player.setGlobalVariables(globalVariables);
    this.#inputs = { ...this.#inputs, variables: globalVariables };
  }

  public async fetchAsset(uri: string): Promise<Asset> {
    if (this.#player.fetchAsset) {
      return await this.#player.fetchAsset(uri);
    }
    throw Error("Player does not support fetching assets");
  }

  async #onPlayerState(playerState: PlayerState) {
    if (this.#skipAliasing) {
      await this.#listener?.(playerState);
      return;
    }

    if (playerState.activeData?.topics !== this.#inputs.topics) {
      this.#inputs = { ...this.#inputs, topics: playerState.activeData?.topics };
    }

    const newState = aliasPlayerState(this.#inputs, this.#subscriptions, playerState);
    await this.#listener?.(newState);

    if (this.#pendingSubscriptions && this.#inputs.topics) {
      this.setSubscriptions(this.#pendingSubscriptions);
    }
  }
}
