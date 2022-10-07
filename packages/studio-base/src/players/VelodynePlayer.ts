// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import { Sockets, UdpRemoteInfo, UdpSocketRenderer } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";
import { Time, fromMillis, add as addTimes, toDate, fromDate, fromMicros } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerState,
  PlayerProblem,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { Model, RawPacket, ReturnMode, packetRate } from "@foxglove/velodyne-cloud";

const log = Logger.getLogger(__filename);

export const DEFAULT_VELODYNE_PORT = 2369;

const RPM = 600;
const PROBLEM_SOCKET_ERROR = "SOCKET_ERROR";
const TOPIC_NAME = "/velodyne_points";
const TOPIC: Topic = { name: TOPIC_NAME, schemaName: "velodyne_msgs/VelodyneScan" };
const DATATYPES: RosDatatypes = new Map(
  Object.entries({
    "velodyne_msgs/VelodyneScan": {
      name: "velodyne_msgs/VelodyneScan",
      definitions: [
        { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
        { type: "velodyne_msgs/VelodynePacket", name: "packets", isArray: true, isComplex: true },
      ],
    },
    "velodyne_msgs/VelodynePacket": {
      name: "velodyne_msgs/VelodynePacket",
      definitions: [
        { type: "time", name: "stamp", isArray: false, isComplex: false },
        { type: "uint8", name: "data", isArray: true, arrayLength: 1206, isComplex: false },
      ],
    },
    "std_msgs/Header": {
      name: "std_msgs/Header",
      definitions: [
        { name: "seq", type: "uint32", isArray: false },
        { name: "stamp", type: "time", isArray: false },
        { name: "frame_id", type: "string", isArray: false },
      ],
    },
  }),
);
const CAPABILITIES: string[] = [];

type VelodynePlayerOpts = {
  port?: number;
  metricsCollector: PlayerMetricsCollectorInterface;
};

export default class VelodynePlayer implements Player {
  private _id: string = uuidv4(); // Unique ID for this player
  private _port: number; // Listening UDP port
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState()
  private _socket?: UdpSocketRenderer;
  private _seq = 0;
  private _totalBytesReceived = 0;
  private _closed: boolean = false; // Whether the player has been completely closed using close()
  private _topic: Topic = { ...TOPIC }; // The one topic we are "subscribed" to
  private _topics = [this._topic]; // Stable list of all topics
  private _topicStats = new Map<string, TopicStats>(); // Message count and timestamps for our single topic
  private _start: Time; // The time at which we started playing
  private _packets: RawPacket[] = []; // Queue of packets that will form the next parsed message
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _presence: PlayerPresence = PlayerPresence.INITIALIZING;
  private _emitTimer?: ReturnType<typeof setTimeout>;

  // track issues within the player
  private _problems: PlayerProblem[] = [];
  private _problemsById = new Map<string, PlayerProblem>();

  public constructor({ port, metricsCollector }: VelodynePlayerOpts) {
    this._port = port ?? DEFAULT_VELODYNE_PORT;
    log.info(`initializing VelodynePlayer on port ${this._port}`);
    this._metricsCollector = metricsCollector;
    this._start = fromMillis(Date.now());
    this._metricsCollector.playerConstructed();
    void this._open();
  }

  private _open = async (): Promise<void> => {
    if (this._closed) {
      return;
    }
    this._presence = PlayerPresence.INITIALIZING;

    if (this._socket == undefined) {
      const net = await Sockets.Create();
      this._socket = await net.createUdpSocket();
      this._socket.on("error", (error) => {
        this._addProblem(PROBLEM_SOCKET_ERROR, {
          message: "Networking error listening for Velodyne data",
          severity: "error",
          error,
          tip: "Check that your are connected to the same local network (subnet) as the Velodyne sensor",
        });
      });
      this._socket.on("message", this._handleMessage);
    } else {
      try {
        await this._socket.close();
      } catch (err) {
        log.error(`Failed to close socket: ${err}`);
      }
    }

    try {
      await this._socket.bind({ address: "0.0.0.0", port: this._port });
      log.debug(`Bound Velodyne UDP listener socket to port ${this._port}`);
    } catch (error) {
      this._addProblem(PROBLEM_SOCKET_ERROR, {
        message: "Could not bind to the Velodyne UDP data port",
        severity: "error",
        error,
        tip: `Check that port ${this._port} is not in use by another application`,
      });
    }
  };

  private _handleMessage = (data: Uint8Array, rinfo: UdpRemoteInfo): void => {
    const receiveTime = fromMillis(Date.now());
    const date = toDate(receiveTime);
    date.setMinutes(0, 0, 0);
    const topOfHour = fromDate(date);

    this._totalBytesReceived += data.byteLength;
    this._presence = PlayerPresence.PRESENT;
    this._clearProblem(PROBLEM_SOCKET_ERROR, { skipEmit: true });

    if (this._seq === 0) {
      this._metricsCollector.initialized();
      this._metricsCollector.recordTimeToFirstMsgs();
    }

    const rawPacket = new RawPacket(data);

    const frequency = RPM / 60.0;
    const rate =
      rawPacket.returnMode === ReturnMode.DualReturn
        ? packetRate(rawPacket.inferModel() ?? Model.HDL64E) * 2
        : packetRate(rawPacket.inferModel() ?? Model.HDL64E);
    const numPackets = Math.ceil(rate / frequency);

    this._packets.push(rawPacket);
    if (this._packets.length >= numPackets) {
      const message = {
        header: { seq: this._seq++, stamp: receiveTime, frame_id: rinfo.address },
        packets: this._packets.map((raw) => rawPacketToRos(raw, topOfHour)),
      };

      const sizeInBytes = this._packets.reduce((acc, packet) => acc + packet.data.byteLength, 0);
      const msg: MessageEvent<unknown> = {
        topic: TOPIC_NAME,
        receiveTime,
        message,
        sizeInBytes,
        schemaName: TOPIC.schemaName,
      };
      this._parsedMessages.push(msg);
      this._packets = [];

      // Update the message count
      let stats = this._topicStats.get(TOPIC_NAME);
      if (!stats) {
        stats = { numMessages: 0 };
        this._topicStats.set(TOPIC_NAME, stats);
      }
      stats.numMessages++;
      stats.firstMessageTime ??= receiveTime;
      stats.lastMessageTime = receiveTime;

      this._emitState();
    }
  };

  private _addProblem(
    id: string,
    problem: PlayerProblem,
    { skipEmit = false }: { skipEmit?: boolean } = {},
  ): void {
    this._problemsById.set(id, problem);
    this._problems = Array.from(this._problemsById.values());
    if (!skipEmit) {
      this._emitState();
    }
  }

  private _clearProblem(id: string, { skipEmit = false }: { skipEmit?: boolean } = {}): void {
    if (!this._problemsById.delete(id)) {
      return;
    }
    this._problems = Array.from(this._problemsById.values());
    if (!skipEmit) {
      this._emitState();
    }
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  private _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    // Time is always moving forward even if we don't get messages from the device.
    // If we are not connected, don't emit updates since we are not longer getting new data
    if (this._presence === PlayerPresence.PRESENT) {
      if (this._emitTimer != undefined) {
        clearTimeout(this._emitTimer);
      }
      this._emitTimer = setTimeout(this._emitState, 100);
    }

    const currentTime = fromMillis(Date.now());
    const messages = this._parsedMessages;
    this._parsedMessages = [];
    return this._listener({
      name: "Velodyne",
      presence: this._presence,
      progress: {},
      capabilities: CAPABILITIES,
      profile: "velodyne",
      playerId: this._id,
      problems: this._problems,

      activeData: {
        messages,
        totalBytesReceived: this._totalBytesReceived,
        startTime: this._start,
        endTime: currentTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        // We don't support seeking, so we need to set this to any fixed value. Just avoid 0 so
        // that we don't accidentally hit falsy checks.
        lastSeekTime: 1,
        topics: this._topics,
        topicStats: new Map(this._topicStats),
        datatypes: DATATYPES,
        publishedTopics: undefined,
        subscribedTopics: undefined,
        services: undefined,
        parameters: undefined,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  public close(): void {
    this._closed = true;
    if (this._socket) {
      void this._socket.dispose();
      this._socket = undefined;
    }
    if (this._emitTimer != undefined) {
      clearTimeout(this._emitTimer);
      this._emitTimer = undefined;
    }
    this._metricsCollector.close();
    this._totalBytesReceived = 0;
    this._seq = 0;
    this._packets = [];
    this._parsedMessages = [];
  }

  public setSubscriptions(_subscriptions: SubscribePayload[]): void {}

  public setPublishers(_publishers: AdvertiseOptions[]): void {
    // no-op
  }

  // Modify a remote parameter such as a rosparam.
  public setParameter(_key: string, _value: ParameterValue): void {
    throw new Error(`Parameter modification is not supported for VelodynePlayer`);
  }

  public publish(_request: PublishPayload): void {
    throw new Error(`Publishing is not supported for VelodynePlayer`);
  }

  public async callService(): Promise<unknown> {
    throw new Error("Service calls are not supported for VelodynePlayer");
  }

  public setGlobalVariables(_globalVariables: GlobalVariables): void {
    // no-op
  }
}

function rawPacketToRos(packet: RawPacket, topOfHour: Time): { stamp: Time; data: Uint8Array } {
  const microSecSinceTopOfHour = packet.gpsTimestamp;
  const stamp = addTimes(topOfHour, fromMicros(microSecSinceTopOfHour));
  return { stamp, data: packet.data };
}
