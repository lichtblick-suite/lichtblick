// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@foxglove/log";
import * as rostime from "@foxglove/rostime";
import { Time } from "@foxglove/rostime";
import { FrameTransform } from "@foxglove/schemas";
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
import { Quaternion } from "@foxglove/studio-base/util/geometry";

import { now } from "./time";
import { BenchmarkStats } from "../BenchmarkStats";

const log = Log.getLogger(__filename);

const TRANSFORMS_PER_TICK = 50;
const CAPABILITIES: string[] = [];

class TransformPlayer implements Player {
  private name: string = "transform";
  private listener?: (state: PlayerState) => Promise<void>;
  private datatypes: RosDatatypes = new Map();

  public constructor() {
    this.datatypes.set("Time", {
      definitions: [
        { name: "sec", type: "uint32" },
        { name: "nsec", type: "uint32" },
      ],
    });

    this.datatypes.set("foxglove.FrameTransform", {
      name: "foxglove.FrameTransform",
      definitions: [
        { name: "timestamp", type: "Time", isComplex: true },
        { name: "parent_frame_id", type: "string" },
        { name: "child_frame_id", type: "string" },
        { name: "translation", type: "Vector3", isComplex: true },
        { name: "rotation", type: "Quaternion", isComplex: true },
      ],
    });
  }

  public setListener(listener: (state: PlayerState) => Promise<void>): void {
    this.listener = listener;
    void this.run();
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

  private async run() {
    const listener = this.listener;
    if (!listener) {
      throw new Error("Invariant: listener is not set");
    }

    log.info("Initializing transform player");

    await listener({
      profile: undefined,
      presence: PlayerPresence.PRESENT,
      name: this.name,
      playerId: this.name,
      capabilities: CAPABILITIES,
      progress: {},
      urlState: {
        sourceId: this.name,
      },
    });

    const topics: Topic[] = [];
    topics.push({ name: "tf", schemaName: "foxglove.FrameTransform" });

    let numMessages = 0;
    let startTime: Time | undefined;
    for (;;) {
      const topicStats = new Map<string, TopicStats>();
      const messages: MessageEvent<FrameTransform>[] = [];
      const timestamp = now();

      if (!startTime) {
        startTime = timestamp;
      }

      messages.push({
        receiveTime: timestamp,
        topic: "tf",
        schemaName: "foxglove.FrameTransform",
        message: {
          timestamp,
          parent_frame_id: "odom",
          child_frame_id: "base_link",
          translation: { x: 1, y: 0, z: 1 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
        sizeInBytes: 86 + "odom".length + "base_link".length,
      });

      for (let i = 0; i < TRANSFORMS_PER_TICK; i++) {
        const curTimestamp = rostime.subtract(timestamp, { sec: 0, nsec: TRANSFORMS_PER_TICK - i });
        messages.push({
          receiveTime: timestamp,
          topic: "tf",
          schemaName: "foxglove.FrameTransform",
          message: {
            timestamp: curTimestamp,
            parent_frame_id: "map",
            child_frame_id: "odom",
            translation: { x: 2, y: 0, z: 1 },
            rotation: currentRotation(timestamp),
          },
          sizeInBytes: 86 + "map".length + "odom".length,
        });
      }

      numMessages += messages.length;

      topicStats.set("tf", {
        numMessages,
        firstMessageTime: startTime,
        lastMessageTime: timestamp,
      });

      const frameStartMs = performance.now();

      await listener({
        profile: undefined,
        presence: PlayerPresence.PRESENT,
        name: this.name,
        playerId: this.name,
        capabilities: CAPABILITIES,
        progress: {},
        activeData: {
          messages,
          totalBytesReceived: 0,
          currentTime: timestamp,
          startTime,
          isPlaying: true,
          speed: 1,
          lastSeekTime: 1,
          endTime: timestamp,
          topics,
          topicStats,
          datatypes: this.datatypes,
        },
      });

      const frameEndMs = performance.now();
      const frameTimeMs = frameEndMs - frameStartMs;

      BenchmarkStats.Instance().recordFrameTime(frameTimeMs);
    }
  }
}

function currentRotation(timestamp: Time): Quaternion {
  const turns = Math.sin(rostime.toSec(timestamp));
  // Convert turns to an Euler rotation around the z axis
  const radians = turns * 2 * Math.PI;
  return {
    x: 0,
    y: 0,
    z: Math.sin(radians / 2),
    w: Math.cos(radians / 2),
  };
}

export { TransformPlayer };
