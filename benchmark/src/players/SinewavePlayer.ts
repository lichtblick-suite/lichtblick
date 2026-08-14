// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@lichtblick/log";
import * as rostime from "@lichtblick/rostime";
import { Time } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";
import { Player, PlayerPresence, Topic, TopicStats } from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

import { BenchmarkPlayerBase } from "./BenchmarkPlayerBase";
import { BenchmarkStats } from "../BenchmarkStats";

const log = Log.getLogger(__filename);

const CAPABILITIES: string[] = [];

class SinewavePlayer extends BenchmarkPlayerBase implements Player {
  readonly #name: string = "sinewave";
  readonly #startTime: Time = rostime.fromDate(new Date());
  readonly #datatypes: RosDatatypes = new Map();

  public constructor() {
    super();
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

  protected async run(): Promise<void> {
    const listener = this.listener;
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

      const messages: MessageEvent[] = [];

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
