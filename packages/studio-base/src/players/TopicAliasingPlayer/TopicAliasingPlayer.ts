// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { MutexLocked } from "@foxglove/den/async";
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

import { IStateProcessor } from "./IStateProcessor";
import { NoopStateProcessor } from "./NoopStateProcessor";
import {
  StateFactoryInput,
  StateProcessorFactory,
  TopicAliasFunctions,
} from "./StateProcessorFactory";

export type { TopicAliasFunctions };

/**
 * This is a player that wraps an underlying player and applies aliases to all topic names
 * in data emitted from the player. It is inserted into the player chain before
 * UserScriptPlayer so that UserScriptPlayer can use the aliased topics.
 *
 * Aliases that alias input topics to other input topics or that request conflicting
 * aliases from multiple input topics to the same output topic are disallowed and flagged
 * as player problems
 */
export class TopicAliasingPlayer implements Player {
  readonly #player: Player;

  #inputs: Immutable<StateFactoryInput>;
  #aliasedSubscriptions: undefined | SubscribePayload[];
  #subscriptions: SubscribePayload[] = [];

  // True if no aliases are active and we can pass calls directly through to the
  // underlying player.
  #skipAliasing: boolean;

  #stateProcessorFactory: StateProcessorFactory = new StateProcessorFactory();
  #stateProcessor: IStateProcessor = new NoopStateProcessor();

  #lastPlayerState?: PlayerState;

  // We only want to be emitting one state at a time however we also queue emits from global
  // variable updates which can happen at a different time to new state from the wrapped player. The
  // mutex prevents invoking the listener concurrently.
  #listener?: MutexLocked<(state: PlayerState) => Promise<void>>;

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
    this.#listener = new MutexLocked(listener);

    this.#player.setListener(async (state) => {
      await this.#onPlayerState(state);
    });
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
    this.#aliasedSubscriptions = this.#stateProcessor.aliasSubscriptions(subscriptions);
    this.#player.setSubscriptions(this.#aliasedSubscriptions);
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

    // Set this before the lastPlayerstate skip below so we have global variables when
    // a player state is provided later.
    this.#inputs = { ...this.#inputs, variables: globalVariables };

    // We can skip re-processing if we don't have any alias functions setup or we have not
    // had any player state provided yet. The player state handler onPlayerState will handle alias
    // function processing when it is called.
    if (
      this.#skipAliasing ||
      this.#lastPlayerState == undefined ||
      this.#inputs.topics == undefined
    ) {
      return;
    }

    const stateProcessor = this.#stateProcessorFactory.buildStateProcessor(this.#inputs);

    // If we have a new state processor, it means something about the aliases has changed and we
    // need to re-process the existing player state
    const shouldReprocess = stateProcessor !== this.#stateProcessor;
    this.#stateProcessor = stateProcessor;

    // If we have a new processor we might also have new subscriptions for downstream
    if (shouldReprocess) {
      this.#resetSubscriptions();
    }

    // Re-process the last player state if the processor has changed since we might have new downstream topics
    // for panels to subscribe or get new re-mapped messages.
    //
    // Skip this if we are playing and allow the next player state update to handle this to avoid
    // these emits interfering with player state updates. It does assume the player is emitting
    // state relatively quickly when playing so the new aliases are injected. If this assumption
    // changes this bail might need revisiting.
    if (shouldReprocess && this.#lastPlayerState.activeData?.isPlaying === false) {
      void this.#onPlayerState(this.#lastPlayerState);
    }
  }

  public async fetchAsset(uri: string): Promise<Asset> {
    if (this.#player.fetchAsset) {
      return await this.#player.fetchAsset(uri);
    }
    throw Error("Player does not support fetching assets");
  }

  async #onPlayerState(playerState: PlayerState) {
    // If we are already emitting a player state, avoid emitting another one
    // This is a guard against global variable emits
    if (this.#listener?.isLocked() === true) {
      return;
    }

    return await this.#listener?.runExclusive(async (listener) => {
      if (this.#skipAliasing) {
        await listener(playerState);
        return;
      }

      // The player topics have changed so we need to re-build the aliases because player topics
      // are an input to the alias functions.
      if (playerState.activeData?.topics !== this.#inputs.topics) {
        this.#inputs = { ...this.#inputs, topics: playerState.activeData?.topics };
        const stateProcessor = this.#stateProcessorFactory.buildStateProcessor(this.#inputs);

        // if the state processor is changed, then we might need to re-process subscriptions since
        // we might now be able to produce new subscriptions
        if (this.#stateProcessor !== stateProcessor) {
          this.#stateProcessor = stateProcessor;
          this.#resetSubscriptions();
        }
      }

      // remember the last player state so we can re-use it when global variables are set
      this.#lastPlayerState = playerState;

      // Process the player state using the latest aliases
      const newState = this.#stateProcessor.process(playerState, this.#subscriptions);
      await listener(newState);
    });
  }

  /**
   * Re-calculate the subscriptions using the latest state processor. If the subscriptions have
   * changed then call setSubscriptions on the wrapped player.
   */
  #resetSubscriptions() {
    const aliasedSubscriptions = this.#stateProcessor.aliasSubscriptions(this.#subscriptions);
    if (!_.isEqual(this.#aliasedSubscriptions, aliasedSubscriptions)) {
      this.#aliasedSubscriptions = aliasedSubscriptions;
      this.#player.setSubscriptions(aliasedSubscriptions);
    }
  }
}
