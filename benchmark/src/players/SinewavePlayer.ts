// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@foxglove/log";
import * as rostime from "@foxglove/rostime";
import { Time } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  Player,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import { BenchmarkStats } from "../BenchmarkStats";

const log = Log.getLogger(__filename);

const CAPABILITIES: string[] = [];

class SinewavePlayer implements Player {
  #name: string = "sinewave";
  #startTime: Time = rostime.fromDate(new Date());
  #listener?: (state: PlayerState) => Promise<void>;
  #datatypes: RosDatatypes = new Map();

  public constructor() {
    this.#datatypes.set("Sinewave", {
      name: "Sinewave",
      definitions: [
        {
          name: "value",
          type: "float32",
        },
      ],
    });
  }

  public setListener(listener: (state: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    void this.#run();
  }
  public close(): void {
    // no-op
  }
  public setSubscriptions(_subscriptions: SubscribePayload[]): void {}
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
    throw new Error("Method not implemented.");
  }

  async #run() {
    const listener = this.#listener;
    if (!listener) {
      throw new Error("Invariant: listener is not set");
    }

    log.info("Initializing sinewave player");

    await listener({
      profile: undefined,
      presence: PlayerPresence.PRESENT,
      name: this.#name,
      playerId: this.#name,
      capabilities: CAPABILITIES,
      progress: {},
      urlState: {
        sourceId: "sinewave",
      },
    });

    const sinewaveCount = 100;

    const topics: Topic[] = [];

    const startTime = rostime.fromDate(new Date());

    for (let i = 0; i < sinewaveCount; ++i) {
      const topicName = `sinewave_${i}`;
      topics.push({ name: topicName, schemaName: "Sinewave" });
    }

    let messageCount = 0;
    for (;;) {
      messageCount += 1;

      const topicStats = new Map<string, TopicStats>();

      const now = rostime.fromDate(new Date());
      const value = Math.sin(rostime.toSec(now));

      const messages: MessageEvent<unknown>[] = [];

      for (let i = 0; i < sinewaveCount; ++i) {
        const topicName = `sinewave_${i}`;
        messages.push({
          receiveTime: now,
          topic: topicName,
          schemaName: "Sinewave",
          message: { value: value + i * 0.1 },
          sizeInBytes: 0,
        });

        topicStats.set(topicName, {
          numMessages: messageCount,
          firstMessageTime: startTime,
          lastMessageTime: now,
        });
      }

      const frameStartMs = performance.now();

      await listener({
        profile: undefined,
        presence: PlayerPresence.PRESENT,
        name: this.#name,
        playerId: this.#name,
        capabilities: CAPABILITIES,
        progress: {},
        activeData: {
          messages,
          totalBytesReceived: 0,
          currentTime: now,
          startTime: this.#startTime,
          isPlaying: true,
          speed: 1,
          lastSeekTime: 1,
          endTime: now,
          topics,
          topicStats,
          datatypes: this.#datatypes,
        },
      });

      const frameEndMs = performance.now();
      const frameTimeMs = frameEndMs - frameStartMs;

      BenchmarkStats.Instance().recordFrameTime(frameTimeMs);
    }
  }
}

export { SinewavePlayer };
