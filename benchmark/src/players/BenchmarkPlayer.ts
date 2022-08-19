// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@foxglove/log";
import { MessageEvent } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { IIterableSource } from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import {
  AdvertiseOptions,
  Player,
  PlayerCapabilities,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";
import delay from "@foxglove/studio-base/util/delay";

const log = Log.getLogger(__filename);

const CAPABILITIES: string[] = [PlayerCapabilities.playbackControl];

class BenchmarkPlayer implements Player {
  private source: IIterableSource;
  private name: string;
  private listener?: (state: PlayerState) => Promise<void>;
  private subscriptions: SubscribePayload[] = [];

  public constructor(name: string, source: BenchmarkPlayer["source"]) {
    this.name = name;
    this.source = source;
  }

  public setListener(listener: (state: PlayerState) => Promise<void>): void {
    this.listener = listener;
    void this.run();
  }
  public close(): void {
    //throw new Error("Method not implemented.");
  }
  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.subscriptions = subscriptions;
  }
  public setPublishers(_publishers: AdvertiseOptions[]): void {
    //throw new Error("Method not implemented.");
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
  public requestBackfill(): void {
    // no-op
  }
  public setGlobalVariables(_globalVariables: GlobalVariables): void {
    throw new Error("Method not implemented.");
  }

  private async run() {
    const listener = this.listener;
    if (!listener) {
      throw new Error("Invariant: listener is not set");
    }

    log.info("Initializing benchmark player");

    await listener({
      profile: undefined,
      presence: PlayerPresence.INITIALIZING,
      name: this.name + "\ninitializing source",
      playerId: this.name,
      capabilities: CAPABILITIES,
      progress: {},
    });

    // initialize
    const result = await this.source.initialize();

    const { start: startTime, end: endTime, topicStats, datatypes, topics } = result;

    // Bail on any problems
    for (const problem of result.problems) {
      throw new Error(problem.message);
    }

    do {
      log.info("Waiting for topic subscriptions...");

      // Allow the layout to subscribe to any messages it needs
      await delay(500);

      await listener({
        profile: undefined,
        presence: PlayerPresence.INITIALIZING,
        name: this.name + "\ngetting messages",
        playerId: this.name,
        capabilities: CAPABILITIES,
        progress: {},
        activeData: {
          messages: [],
          totalBytesReceived: 0,
          currentTime: startTime,
          startTime,
          isPlaying: false,
          speed: 1,
          lastSeekTime: 1,
          endTime,
          topics,
          topicStats,
          datatypes,
        },
      });
    } while (this.subscriptions.length === 0);

    // Get all messages for our subscriptions
    const subscribeTopics = this.subscriptions.map((sub) => sub.topic);
    const iterator = this.source.messageIterator({
      topics: subscribeTopics,
    });

    const msgEvents: MessageEvent<unknown>[] = [];
    const frameMs: number[] = [];

    // Load all messages into memory
    for await (const item of iterator) {
      // any problem bails
      if (item.problem) {
        throw new Error(item.problem.message);
      }
      msgEvents.push(item.msgEvent);
      frameMs.push(0);
    }

    log.info(`Starting playback of ${msgEvents.length} message events`);

    performance.mark("message-emit-start");

    let totalBytesReceived = 0;
    for (let i = 0; i < msgEvents.length; i++) {
      const msgEvent = msgEvents[i]!;
      totalBytesReceived += msgEvent.sizeInBytes;
      const startFrame = performance.now();
      await listener({
        profile: undefined,
        presence: PlayerPresence.PRESENT,
        name: this.name,
        playerId: this.name,
        capabilities: CAPABILITIES,
        progress: {},
        activeData: {
          messages: [msgEvent],
          totalBytesReceived,
          startTime,
          endTime,
          currentTime: msgEvent.receiveTime,
          isPlaying: true,
          speed: 1,
          lastSeekTime: 1,
          topics,
          topicStats,
          datatypes,
        },
      });
      const endFrame = performance.now();
      frameMs[i] = endFrame - startFrame;
    }

    performance.mark("message-emit-end");
    performance.measure("message-emit", "message-emit-start", "message-emit-end");

    // Discard the first and last frames
    const filteredFrameMs = frameMs.slice(1, -1);

    const totalFrameMs = filteredFrameMs.reduce((a, b) => a + b, 0);
    const avgFrameMs = totalFrameMs / filteredFrameMs.length;

    const sortedFrameMs = filteredFrameMs.sort();
    const medianFrameMs = sortedFrameMs[Math.floor(sortedFrameMs.length * 0.5)]!;
    const p90FrameMs = sortedFrameMs[Math.floor(sortedFrameMs.length * 0.9)]!;

    log.info(
      `Frame time (filtered) average: ${avgFrameMs}, median: ${medianFrameMs}, P90: ${p90FrameMs}`,
    );
    // eslint-disable-next-line no-restricted-syntax
    console.log(frameMs);
  }
}

export { BenchmarkPlayer };
