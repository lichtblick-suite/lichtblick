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

const SCALE = 10 / 128;

function rgba(r: number, g: number, b: number, a: number) {
  return (
    (Math.trunc(r * 255) << 24) |
    (Math.trunc(g * 255) << 16) |
    (Math.trunc(b * 255) << 8) |
    Math.trunc(a * 255)
  );
}

enum NumericType {
  UINT8 = 1,
  INT8 = 2,
  UINT16 = 3,
  INT16 = 4,
  UINT32 = 5,
  INT32 = 6,
  FLOAT32 = 7,
  FLOAT64 = 8,
}

type FoxglovePose = {
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
};

type FoxglovePointCloud = {
  timestamp: { sec: number; nsec: number };
  frame_id: string;
  pose: FoxglovePose;
  point_stride: number;
  fields: Array<{ name: string; offset: number; type: NumericType }>;
  data: Uint8Array;
};

const QUAT_IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const VEC3_ZERO = { x: 0, y: 0, z: 0 };

function f(x: number, y: number) {
  return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
}

function jet(x: number, a: number): number {
  const i = Math.trunc(x * 255);
  const r = Math.max(0, Math.min(255, 4 * (i - 96), 255 - 4 * (i - 224)));
  const g = Math.max(0, Math.min(255, 4 * (i - 32), 255 - 4 * (i - 160)));
  const b = Math.max(0, Math.min(255, 4 * i + 127, 255 - 4 * (i - 96)));
  return rgba(r / 255, g / 255, b / 255, a);
}

function makePointCloud(stamp: rostime.Time): FoxglovePointCloud {
  const rgbaFieldName = "rgba";

  const data = new Uint8Array(128 * 128 * 16);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const randomZOffset = Math.random();

  for (let y = 0; y < 128; y += 3) {
    for (let x = 0; x < 128; x += 3) {
      const i = (y * 128 + x) * 16;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5 + randomZOffset, true);
      view.setUint32(i + 12, jet(f(x, y) * 2, x / 128), true);
    }
  }

  return {
    timestamp: stamp,
    frame_id: "sensor",
    pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
    point_stride: 16,
    fields: [
      { name: "x", offset: 0, type: 7 },
      { name: "y", offset: 4, type: 7 },
      { name: "z", offset: 8, type: 7 },
      { name: rgbaFieldName, offset: 12, type: 6 },
    ],
    data,
  };
}

class PointcloudPlayer implements Player {
  #name: string = "pointcloud";
  #startTime: Time = rostime.fromDate(new Date());
  #listener?: (state: PlayerState) => Promise<void>;
  #datatypes: RosDatatypes = new Map();

  public constructor() {
    this.#datatypes.set("Time", {
      definitions: [
        {
          name: "sec",
          type: "uint32",
        },
        {
          name: "nsec",
          type: "uint32",
        },
      ],
    });

    this.#datatypes.set("foxglove.PointCloud", {
      name: "foxglove.PointCloud",
      definitions: [
        {
          name: "timestamp",
          type: "Time",
          isComplex: true,
        },
        {
          name: "frame_id",
          type: "string",
        },
        {
          name: "data",
          type: "uint8",
          isArray: true,
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

    log.info("Initializing pointcloud player");

    await listener({
      profile: undefined,
      presence: PlayerPresence.PRESENT,
      name: this.#name,
      playerId: this.#name,
      capabilities: CAPABILITIES,
      progress: {},
      urlState: {
        sourceId: "pointcloud",
      },
    });

    const pointcloudCount = 10;

    const topics: Topic[] = [];

    const startTime = rostime.fromDate(new Date());

    for (let i = 0; i < pointcloudCount; ++i) {
      const topicName = `pointcloud_${i}`;
      topics.push({ name: topicName, schemaName: "foxglove.PointCloud" });
    }

    let messageCount = 0;
    for (;;) {
      messageCount += 1;

      const topicStats = new Map<string, TopicStats>();

      const now = rostime.fromDate(new Date());

      const messages: MessageEvent[] = [];

      for (let i = 0; i < pointcloudCount; ++i) {
        const topicName = `pointcloud_${i}`;
        const pointcloudMsg = makePointCloud(now);
        messages.push({
          receiveTime: now,
          topic: topicName,
          message: pointcloudMsg,
          schemaName: "foxglove.PointCloud",
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

export { PointcloudPlayer };
