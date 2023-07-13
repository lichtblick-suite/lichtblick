// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@foxglove/log";
import { Time, compare } from "@foxglove/rostime";
import { FrameTransform, Vector3 } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { normalizeFrameTransform } from "@foxglove/studio-base/panels/ThreeDeeRender/normalizeMessages";
import {
  AdvertiseOptions,
  BlockCache,
  MessageBlock,
  Player,
  PlayerCapabilities,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import delay from "@foxglove/studio-base/util/delay";

const log = Log.getLogger(__filename);

const CAPABILITIES: string[] = [PlayerCapabilities.playbackControl];

class TransformPreloadingPlayer implements Player {
  #name: string = "transformpreloading";
  #listener?: (state: PlayerState) => Promise<void>;
  #datatypes: RosDatatypes = new Map();
  #startTime: Time;
  #endTime: Time;
  #topicStats: Map<string, TopicStats>;
  #topics: Topic[];

  public constructor() {
    this.#datatypes.set("Time", {
      definitions: [
        { name: "sec", type: "uint32" },
        { name: "nsec", type: "uint32" },
      ],
    });

    this.#datatypes.set("foxglove.FrameTransform", {
      name: "foxglove.FrameTransform",
      definitions: [
        { name: "timestamp", type: "Time", isComplex: true },
        { name: "parent_frame_id", type: "string" },
        { name: "child_frame_id", type: "string" },
        { name: "translation", type: "Vector3", isComplex: true },
        { name: "rotation", type: "Quaternion", isComplex: true },
      ],
    });
    this.#startTime = { sec: 0, nsec: 0 };
    this.#endTime = { sec: 600, nsec: 0 };

    this.#topicStats = new Map([
      [
        "/100hz",
        {
          numMessages: 60000,
          firstMessageTime: { sec: 0, nsec: 0 },
          lastMessageTime: { sec: 600, nsec: 0 },
        },
      ],
      [
        "/150hz",
        {
          numMessages: 90000,
          firstMessageTime: { sec: 0, nsec: 0 },
          lastMessageTime: { sec: 600, nsec: 0 },
        },
      ],
    ]);

    this.#topics = [
      {
        name: "/100hz",
        schemaName: "foxglove.FrameTransform",
      },
      {
        name: "/150hz",
        schemaName: "foxglove.FrameTransform",
      },
    ];
  }

  public setListener(listener: (state: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    void this.#run();
  }
  public close(): void {
    // no-op
  }
  public setSubscriptions(_subs: SubscribePayload[]): void {
    // no-op
  }
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

    log.info("Initializing transform preloading player");

    await listener({
      profile: undefined,
      presence: PlayerPresence.PRESENT,
      name: this.#name,
      playerId: this.#name,
      capabilities: CAPABILITIES,
      progress: {},
      urlState: {
        sourceId: this.#name,
      },
    });

    await listener({
      profile: undefined,
      presence: PlayerPresence.INITIALIZING,
      name: this.#name + "\ngetting messages",
      playerId: this.#name,
      capabilities: CAPABILITIES,
      progress: {},
      activeData: {
        messages: [],
        totalBytesReceived: 0,
        currentTime: this.#startTime,
        startTime: this.#startTime,
        isPlaying: false,
        speed: 1,
        lastSeekTime: 1,
        endTime: this.#endTime,
        topics: this.#topics,
        topicStats: this.#topicStats,
        datatypes: this.#datatypes,
      },
    });

    log.info("Preloading messages");
    performance.mark("preloading-start");
    const msgs100Hz = getTfMessages({
      topic: "/100hz",
      startSeconds: 0,
      endSeconds: this.#endTime.sec,
      tfParams: {
        axis: "x",
        parent: "base_link",
        frequencyHz: 100,
        translation: { x: 0, y: 0, z: 0 },
      },
    });
    const msgs150Hz = getTfMessages({
      topic: "/150hz",
      startSeconds: 0,
      endSeconds: this.#endTime.sec,
      tfParams: { axis: "z", parent: "100hz", frequencyHz: 150, translation: { x: 0, y: 0, z: 1 } },
    });

    const allMessages = [...msgs100Hz, ...msgs150Hz];
    allMessages.sort((a, b) => compare(a.receiveTime, b.receiveTime));

    const numBlocks = 200;
    const blocks = [];
    const numMessagesPerBlock100Hz = Math.ceil(msgs100Hz.length / numBlocks);
    const numMessagesPerBlock150Hz = Math.ceil(msgs150Hz.length / numBlocks);
    for (let i = 0; i < numBlocks; i++) {
      const block = { messagesByTopic: {}, sizeInBytes: 1 };
      const start100HzIndex = i * numMessagesPerBlock100Hz;
      const start150HzIndex = i * numMessagesPerBlock150Hz;

      block.messagesByTopic = {
        "/100hz": msgs100Hz.slice(
          start100HzIndex,
          Math.min(start100HzIndex + numMessagesPerBlock100Hz, msgs100Hz.length),
        ),
        "/150hz": msgs150Hz.slice(
          start150HzIndex,
          Math.min(start150HzIndex + numMessagesPerBlock150Hz, msgs150Hz.length),
        ),
      };
      blocks.push(block as MessageBlock);
    }

    const progressForListener = {
      messageCache: {
        blocks,
        startTime: { sec: 0, nsec: 0 },
      } as BlockCache,
      fullyLoadedFractionRanges: [{ start: 0, end: 1 }],
    };

    performance.mark("preloading-end");
    performance.measure("preloading", "preloading-start", "preloading-end");

    const tries = 20;
    const steps = 10;
    let seekFramesMsTotals: number[] = new Array(steps).fill(0);
    for (let count = 0; count < tries; count++) {
      const seekFramesMs = [];
      // test seek forward over 10 steps
      for (let i = 0; i < steps; i++) {
        const seekToMessage = allMessages[Math.floor((i / steps) * allMessages.length)]!;
        const startFrame = performance.now();
        await listener({
          profile: undefined,
          presence: PlayerPresence.PRESENT,
          name: this.#name,
          playerId: this.#name,
          capabilities: CAPABILITIES,
          progress: progressForListener,
          activeData: {
            messages: [seekToMessage],
            totalBytesReceived: 1,
            startTime: this.#startTime,
            endTime: this.#endTime,
            currentTime: seekToMessage.receiveTime,
            isPlaying: false,
            speed: 1,
            lastSeekTime: Date.now(),
            topics: this.#topics,
            topicStats: this.#topicStats,
            datatypes: this.#datatypes,
          },
        });
        const endFrame = performance.now();
        seekFramesMs.push(endFrame - startFrame);
      }
      // eslint-disable-next-line no-loop-func
      seekFramesMs.forEach((ms, i) => (seekFramesMsTotals[i]! += ms));
    }

    log.info(`Number of messages: ${allMessages.length}`);
    log.info(
      `Seek frame average times from beginning to end of playtime. Should remain generally constant:\n ${seekFramesMsTotals
        .map((total) => {
          return (total / tries).toFixed(2);
        })
        .join("ms, ")}ms`,
    );

    await delay(1000);
    seekFramesMsTotals = new Array(steps).fill(0);
    for (let count = 0; count < tries; count++) {
      const seekFramesMs = [];
      // test seek backwards over 10 steps
      for (let i = steps - 1; i >= 0; i--) {
        const seekToMessage = allMessages[Math.floor((i / steps) * allMessages.length)]!;
        const startFrame = performance.now();
        await listener({
          profile: undefined,
          presence: PlayerPresence.PRESENT,
          name: this.#name,
          playerId: this.#name,
          capabilities: CAPABILITIES,
          progress: progressForListener,
          activeData: {
            messages: [seekToMessage],
            totalBytesReceived: 1,
            startTime: this.#startTime,
            endTime: this.#endTime,
            currentTime: seekToMessage.receiveTime,
            isPlaying: false,
            speed: 1,
            lastSeekTime: Date.now(),
            topics: this.#topics,
            topicStats: this.#topicStats,
            datatypes: this.#datatypes,
          },
        });
        const endFrame = performance.now();
        seekFramesMs.push(endFrame - startFrame);
      }
      seekFramesMs.forEach((ms, i) => (seekFramesMsTotals[i]! += ms));
    }

    log.info(
      `Seek frame average times from end to beginning of playtime. Should start high and decrease:\n ${seekFramesMsTotals
        .map((total) => {
          return (total / tries).toFixed(2);
        })
        .join("ms, ")}ms`,
    );
  }
}

type TFParams = {
  frequencyHz: number;
  parent: string;
  axis: "x" | "y" | "z";
  translation: Vector3;
};
const quatIdentity = { x: 0, y: 0, z: 0, w: 1 };

function getTfMessages({
  tfParams,
  topic,
  startSeconds,
  endSeconds,
}: {
  tfParams: TFParams;
  startSeconds: number;
  endSeconds: number;
  topic: string;
}): MessageEvent<FrameTransform>[] {
  const numberOfMessages = (endSeconds - startSeconds) * tfParams.frequencyHz;
  const tf = normalizeFrameTransform(undefined);
  tf.child_frame_id = `${tfParams.frequencyHz}hz`;
  tf.parent_frame_id = tfParams.parent;
  tf.rotation = quatIdentity;
  tf.translation = tfParams.translation;
  const steps = 10;
  const dist = 10;

  // let axisIncrease = 0;
  const secondsBetweenMessages = 1 / tfParams.frequencyHz;
  const messages = [];
  for (let i = 0; i < numberOfMessages; i++) {
    const frameTf = normalizeFrameTransform(tf);
    frameTf.translation[tfParams.axis] = (((i % steps) + 1) / steps) * dist;
    const logTimeNs = Math.floor(startSeconds) * 1e9 + Math.floor(secondsBetweenMessages * 1e9) * i;
    frameTf.timestamp = {
      sec: Math.floor(logTimeNs / 1e9),
      nsec: logTimeNs % 1e9,
    };
    const message: MessageEvent<FrameTransform> = {
      receiveTime: frameTf.timestamp,
      topic,
      schemaName: "foxglove.FrameTransform",
      sizeInBytes: 86 + frameTf.parent_frame_id.length + frameTf.child_frame_id.length,
      message: frameTf,
    };
    messages.push(message);
  }

  return messages;
}

export { TransformPreloadingPlayer };
