// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// import { filterMap } from "@lichtblick/den/collection";
import * as _ from "lodash-es";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@lichtblick/den/async";
import Log from "@lichtblick/log";
import { parse as parseMessageDefinition } from "@lichtblick/rosmsg";
import { MessageReader as ROS1MessageReader } from "@lichtblick/rosmsg-serialization";
import { MessageReader as ROS2MessageReader } from "@lichtblick/rosmsg2-serialization";
import { Time, fromMillis, toSec } from "@lichtblick/rostime";
import { ParameterValue } from "@lichtblick/suite";
import PlayerProblemManager from "@lichtblick/suite-base/players/PlayerProblemManager";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  PlayerPresence,
  PlayerMetricsCollectorInterface,
  TopicStats,
  TopicWithSchemaName,
} from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { bagConnectionsToDatatypes } from "@lichtblick/suite-base/util/bagConnectionsHelper";

import RosboardClient, { PubTopic } from "./RosboardClient";

const log = Log.getLogger(__dirname);

// TODO: Review this? Rosboard doesn't support calling services.
const CAPABILITIES = [PLAYER_CAPABILITIES.advertise, PLAYER_CAPABILITIES.callServices];

/*
// From RosbridgePlayer.ts
type RosNodeDetails = Record<
  "subscriptions" | "publications" | "services",
  { node: string; values: string[] }
>;

function collateNodeDetails(
  details: RosNodeDetails[],
  key: keyof RosNodeDetails,
): Map<string, Set<string>> {
  return _.transform(
    details,
    (acc, detail) => {
      const { node, values } = detail[key];
      for (const value of values) {
        if (!acc.has(value)) {
          acc.set(value, new Set());
        }
        acc.get(value)?.add(node);
      }
    },
    new Map<string, Set<string>>(),
  );
}
*/

function isClockMessage(topic: string, msg: unknown): msg is { clock: Time } {
  const maybeClockMsg = msg as { clock?: Time };
  return topic === "/clock" && maybeClockMsg.clock != undefined && !isNaN(maybeClockMsg.clock.sec);
}

/*
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined;
}
*/

interface TypeIndex {
  [type: string]: string | undefined;
}

// Connects to `rosboard_server` instance using `rosboard`.
export default class RosboardPlayer implements Player {
  #url: string; // WebSocket URL.

  #typeIndex: TypeIndex = {};

  #cachedImages: { [topic: string]: Uint8Array } = {};
  #cachedGrids: { [topic: string]: Int8Array } = {};

  #rosClient?: RosboardClient; // The rosboard client when we're connected.
  #id: string = uuidv4(); // Unique ID for this player.
  #isRefreshing = false; // True if currently refreshing the node graph.
  #listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  #closed: boolean = false; // Whether the player has been completely closed using close().
  #providerTopics?: TopicWithSchemaName[]; // Topics as published by the WebSocket.
  #providerTopicsStats = new Map<string, TopicStats>(); // topic names to topic statistics.
  #providerDatatypes?: RosDatatypes; // Datatypes as published by the WebSocket.
  #publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  #subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  #services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  #messageReadersByDatatype: {
    [datatype: string]: ROS1MessageReader | ROS2MessageReader;
  } = {};
  #start?: Time; // The time at which we started playing.
  #clockTime?: Time; // The most recent published `/clock` time, if available
  // active subscriptions
  #topicSubscriptions = new Set<string>();
  #requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  #parsedMessages: MessageEvent[] = []; // Queue of messages that we'll send in next _emitState() call.
  #requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics().
  // active publishers for the current connection
  #topicPublishers = new Map<string, PubTopic>();
  // which topics we want to advertise to other nodes
  #advertisements: AdvertiseOptions[] = [];
  #parsedTopics = new Set<string>();
  #receivedBytes: number = 0;
  #metricsCollector: PlayerMetricsCollectorInterface;
  #presence: PlayerPresence = PlayerPresence.NOT_PRESENT;
  #problems = new PlayerProblemManager();
  #emitTimer?: ReturnType<typeof setTimeout>;
  #serviceTypeCache = new Map<string, Promise<string>>();
  readonly #sourceId: string;
  #rosVersion: 1 | 2 | undefined;

  public constructor({
    url,
    metricsCollector,
    sourceId,
  }: {
    url: string;
    metricsCollector: PlayerMetricsCollectorInterface;
    sourceId: string;
  }) {
    this.#presence = PlayerPresence.INITIALIZING;
    this.#metricsCollector = metricsCollector;
    this.#url = url;
    this.#start = fromMillis(Date.now());
    this.#metricsCollector.playerConstructed();
    this.#sourceId = sourceId;
    this.#open();
  }

  #open = (): void => {
    if (this.#closed) {
      return;
    }
    if (this.#rosClient != undefined) {
      throw new Error(`Attempted to open a second Rosboard connection`);
    }
    this.#problems.removeProblem("rosboard:connection-failed");
    log.info(`Opening connection to ${this.#url}`);

    const rosClient = new RosboardClient({ url: this.#url });

    rosClient.on("connection", () => {
      log.info(`Connected to ${this.#url}`);
      if (this.#closed) {
        return;
      }
      this.#presence = PlayerPresence.PRESENT;
      this.#problems.removeProblem("rosboard:connection-failed");
      this.#rosClient = rosClient;

      this.#setupPublishers();
      void this.#requestTopics({ forceUpdate: true });
    });

    rosClient.on("error", (err) => {
      if (err) {
        this.#problems.addProblem("rosboard:error", {
          severity: "warn",
          message: "Rosboard error",
          error: err,
        });
        this.#emitState();
      }
    });

    rosClient.on("close", () => {
      this.#presence = PlayerPresence.RECONNECTING;

      if (this.#requestTopicsTimeout) {
        clearTimeout(this.#requestTopicsTimeout);
      }
      for (const topicName of this.#topicSubscriptions) {
        // topic.unsubscribe();
        if (this.#rosClient !== undefined) {
          this.#rosClient.unsubscribe(topicName);
        }
        this.#topicSubscriptions.delete(topicName);
      }
      rosClient.close(); // ensure the underlying worker is cleaned up
      this.#rosClient = undefined;

      this.#problems.addProblem("rosboard:connection-failed", {
        severity: "error",
        message: "Connection failed",
        tip: `Check that the rosboard WebSocket server at ${this.#url} is reachable.`,
      });

      this.#emitState();

      // Try connecting again.
      setTimeout(this.#open, 3000);
    });
  };

  #topicsChanged = (newTopics: Topic[]): boolean => {
    if (!this.#providerTopics || newTopics.length !== this.#providerTopics.length) {
      return true;
    }
    return !_.isEqual(this.#providerTopics, newTopics);
  };

  async #requestTopics(opt?: { forceUpdate: boolean }): Promise<void> {
    const { forceUpdate = false } = opt ?? {};
    // clear problems before each topics request so we don't have stale problems from previous failed requests
    this.#problems.removeProblems((id) => id.startsWith("requestTopics:"));

    if (this.#requestTopicsTimeout) {
      clearTimeout(this.#requestTopicsTimeout);
    }
    const rosClient = this.#rosClient;
    if (!rosClient || this.#closed) {
      return;
    }

    // getTopicsAndRawTypes might silently hang. When this happens, there is no indication to the user
    // that the connection is doing anything and studio shows no errors and no data.
    // This logic adds a warning after 5 seconds (picked arbitrarily) to display a notice to the user.

    const topicsStallWarningTimeout = setTimeout(() => {
      this.#problems.addProblem("topicsAndRawTypesTimeout", {
        severity: "warn",
        message: "Taking too long to get topics and raw types.",
      });

      this.#emitState();
    }, 5000);

    try {
      const result = rosClient.availableTopics;

      if (this.#typeIndex == undefined) {
        rosClient.requestTopicsFull();
      }
      this.#typeIndex = rosClient.topicsFull;

      clearTimeout(topicsStallWarningTimeout);

      this.#problems.removeProblem("topicsAndRawTypesTimeout");

      const topicsMissingDatatypes: string[] = [];
      const topics: TopicWithSchemaName[] = [];
      const datatypeDescriptions = [];
      const messageReaders: Record<string, ROS1MessageReader | ROS2MessageReader> = {};

      this.#rosVersion = 2;

      for (const [topicName, type] of Object.entries(result)) {
        const messageDefinition = this.#typeIndex[type];

        if (type == undefined || messageDefinition == undefined) {
          topics.push({ name: topicName + " (UNDEFINED DATATYPE)", schemaName: type });
          topicsMissingDatatypes.push(topicName);
          continue;
        }
        topics.push({ name: topicName, schemaName: type });
        datatypeDescriptions.push({ type, messageDefinition });
        const parsedDefinition = parseMessageDefinition(messageDefinition, {
          ros2: this.#rosVersion === 2,
        });
        // https://github.com/typescript-eslint/typescript-eslint/issues/6632
        if (!messageReaders[type]) {
          messageReaders[type] =
            this.#rosVersion !== 2
              ? new ROS1MessageReader(parsedDefinition)
              : new ROS2MessageReader(parsedDefinition);
        }
      }

      if (topicsMissingDatatypes.length > 0) {
        rosClient.requestTopicsFull();
      }

      // We call requestTopics on a timeout to check for new topics. If there are no changes to topics
      // we want to bail and avoid updating readers, subscribers, etc.
      // However, during a re-connect, we _do_ want to refresh this list and re-subscribe
      const sortedTopics = _.sortBy(topics, "name");
      if (!forceUpdate && !this.#topicsChanged(sortedTopics)) {
        return;
      }

      if (topicsMissingDatatypes.length > 0) {
        this.#problems.addProblem("requestTopics:missing-types", {
          severity: "warn",
          message: "Could not resolve all message types",
          tip: `Message types could not be found for these topics: ${topicsMissingDatatypes.join(
            ",",
          )}`,
        });
      }

      // Remove stats entries for removed topics
      const topicsSet = new Set<string>(topics.map((topic) => topic.name));
      for (const topic of this.#providerTopicsStats.keys()) {
        if (!topicsSet.has(topic)) {
          this.#providerTopicsStats.delete(topic);
        }
      }

      this.#providerTopics = sortedTopics;

      this.#providerDatatypes = bagConnectionsToDatatypes(datatypeDescriptions, {
        ros2: this.#rosVersion === 2,
      });
      this.#messageReadersByDatatype = messageReaders;

      // Try subscribing again, since we might now be able to subscribe to some new topics.
      this.setSubscriptions(this.#requestedSubscriptions);
    } catch (error) {
      log.error(error);
      clearTimeout(topicsStallWarningTimeout);
      this.#problems.removeProblem("topicsAndRawTypesTimeout");

      this.#problems.addProblem("requestTopics:error", {
        severity: "error",
        message: "Failed to fetch topics from rosboard",
        error,
      });
    } finally {
      this.#emitState();

      // Regardless of what happens, request topics again in a little bit.
      this.#requestTopicsTimeout = setTimeout(() => void this.#requestTopics(), 3000);
    }
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  #emitState = debouncePromise(() => {
    if (!this.#listener || this.#closed) {
      return Promise.resolve();
    }

    const providerTopics = this.#providerTopics;
    const providerDatatypes = this.#providerDatatypes;
    const start = this.#start;
    if (!providerTopics || !providerDatatypes || !start) {
      return this.#listener({
        name: this.#url,
        presence: this.#presence,
        progress: {},
        capabilities: CAPABILITIES,
        profile: undefined,
        playerId: this.#id,
        activeData: undefined,
        problems: this.#problems.problems(),
        urlState: {
          sourceId: this.#sourceId,
          parameters: { url: this.#url },
        },
      });
    }

    // When connected
    // Time is always moving forward even if we don't get messages from the server.
    if (this.#presence === PlayerPresence.PRESENT) {
      if (this.#emitTimer != undefined) {
        clearTimeout(this.#emitTimer);
      }
      this.#emitTimer = setTimeout(this.#emitState, 100);
    }

    const currentTime = this.#getCurrentTime();
    const messages = this.#parsedMessages;
    this.#parsedMessages = [];
    return this.#listener({
      name: this.#url,
      presence: this.#presence,
      progress: {},
      capabilities: CAPABILITIES,
      profile: this.#rosVersion === 2 ? "ros2" : "ros1",
      playerId: this.#id,
      problems: this.#problems.problems(),
      urlState: {
        sourceId: this.#sourceId,
        parameters: { url: this.#url },
      },

      activeData: {
        messages,
        totalBytesReceived: this.#receivedBytes,
        startTime: start,
        endTime: currentTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        // We don't support seeking, so we need to set this to any fixed value. Just avoid 0 so
        // that we don't accidentally hit falsy checks.
        lastSeekTime: 1,
        topics: providerTopics,
        // Always copy topic stats since message counts and timestamps are being updated
        topicStats: new Map(this.#providerTopicsStats),
        datatypes: providerDatatypes,
        publishedTopics: this.#publishedTopics,
        subscribedTopics: this.#subscribedTopics,
        services: this.#services,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    this.#emitState();
  }

  public scaleBackInt16(value: number, min: number, max: number): number {
    if (min === max) {
      return min;
    } // Prevent division by zero
    return (value / 65535) * (max - min) + min;
  }

  public close(): void {
    this.#closed = true;
    if (this.#rosClient) {
      this.#rosClient.close();
    }
    if (this.#emitTimer != undefined) {
      clearTimeout(this.#emitTimer);
      this.#emitTimer = undefined;
    }
  }

  // Rosboard features some compressed messages to come also decoded
  // in base64
  public _base64decode(base64: string) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // In rosboard, laser scan messages come scaled into uint16 values
  // and use _ranges_uint16.bounds to scale them back to Float32 renderable format
  public decodeLaserScanMsg(message: any): void {
    const rbounds = message._ranges_uint16.bounds;

    const rdata = this._base64decode(message._ranges_uint16.points);

    const rview = new DataView(rdata);
    const num_ranges = rdata.byteLength / 2;
    const points = new Float32Array(num_ranges);

    const rrange = rbounds[1] - rbounds[0];
    const rmin = rbounds[0];

    for (let i = 0; i < num_ranges; i++) {
      const offset = i * 2;

      const r_uint16 = rview.getUint16(offset, true);

      if (r_uint16 === 65535) {
        points[i] = NaN;
        continue; // nan, -inf, inf mapped to 65535
      }

      const r = (r_uint16 / 65534) * rrange + rmin;
      points[i] = r;
    }
    message.ranges = points;
    message.intensities = points;
  }

  // Images come in regular base64-encoded jpeg data which
  // is decoded into it's raw format for visualization
  public decodeImageMsg(message: any): void {
    const rdata = message._data_jpeg;

    if (this.#cachedImages[message._topic_name] != undefined) {
      message.data = this.#cachedImages[message._topic_name];
    }

    const numChannels: number = message.encoding === "mono8" ? 1 : 3;

    // Decode the base64 JPEG to pixel data
    decodeBase64Jpeg(rdata, numChannels)
      .then((pixelData) => {
        // Assign the decoded RGB pixel data to message.data
        message.data = pixelData; // Uint8Array
        this.#cachedImages[message._topic_name] = pixelData;
      })
      .catch((error) => {
        console.error("Error decoding image:", error);
      });
  }

  // Occupancy grid messages come in regular base64 png format
  // In contrast with decodeImageMsg, the raw rgb data must be merged
  // into a single channel gray-scaled data
  public decodeOccupancyGridMsg(message: any): void {
    const rdata = message._data_jpeg;

    if (this.#cachedGrids[message._topic_name] != undefined) {
      message.data = this.#cachedGrids[message._topic_name];
    }

    // Decode the base64 PNG to pixel data
    decodeBase64Png(rdata)
      .then((pixelData) => {
        // Assign the decoded RGB pixel data to message.data
        const decodedA = new Int8Array(pixelData); // Uint8Array

        const sumsArray = [];
        const alen = decodedA.length;
        if (decodedA != undefined) {
          // Transform RGB to grayscale using luminocity method coefficients
          for (let i = 0; i < alen; i += 3) {
            sumsArray.push(
              0.3 * (decodedA[i] || 0) +
                0.59 * (decodedA[i + 1] || 0) +
                0.11 * (decodedA[i + 2] || 0),
            );
          }
          this.#cachedGrids[message._topic_name] = new Int8Array(sumsArray);
          message.data = this.#cachedGrids[message._topic_name];
        }
      })
      .catch((error) => {
        console.error("Error decoding image:", error);
      });
  }

  // In terms of array type convertions, this method does the same as
  // decodeLaserScanMsg, but this time we have got 3 channels, thus
  // we are using scaleBackInt16 helper to handle the uint16 to Float32
  // convertions in an sligtly different manner as in the former example:
  // (this time inf/NaN values are not mapped)
  public decodePointCloud2Msg(message: any): void {
    const rdata = this._base64decode(message._data_uint16.points);
    const rview = new DataView(rdata);

    const num_ranges = rdata.byteLength / 6;

    const bounds: number[] = message._data_uint16.bounds;

    const xmin: number = bounds[0] || 0,
      xmax: number = bounds[1] || 0;
    const ymin: number = bounds[2] || 0,
      ymax: number = bounds[3] || 0;
    const zmin: number = bounds[4] || 0,
      zmax: number = bounds[5] || 0;

    const pointsFloat32: Float32Array = new Float32Array(num_ranges * 3);

    for (let i: number = 0; i < num_ranges; i++) {
      const offset = i * 6;
      const x: number = rview.getUint16(offset, true);
      const y: number = rview.getUint16(offset + 2, true);
      const z: number = rview.getUint16(offset + 4, true);

      pointsFloat32[i * 3] = this.scaleBackInt16(x, xmin, xmax);
      pointsFloat32[i * 3 + 1] = this.scaleBackInt16(y, ymin, ymax);
      pointsFloat32[i * 3 + 2] = this.scaleBackInt16(z, zmin, zmax);
    }

    const buffer = pointsFloat32.buffer;
    const points: Uint8Array = new Uint8Array(buffer);

    // Adjust the dimentions to fit for 1D (unordered clouds)
    message.width = pointsFloat32.length / 3;

    // Unordered clouds always have the following height = 1 and point_step = 12
    // This means that clouds which come with more dimentions will be also
    // treated as one-dimentional
    message.height = 1;
    message.point_step = 12;
    message.row_step = message.width * message.point_step;

    message.data = points;
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.#requestedSubscriptions = subscriptions;

    if (!this.#rosClient || this.#closed) {
      return;
    }

    // Subscribe to additional topics used by RosboardPlayer itself
    this.#addInternalSubscriptions(subscriptions);

    this.#parsedTopics = new Set(subscriptions.map(({ topic }) => topic));

    // See what topics we actually can subscribe to.
    const availableTopicsByTopicName = _.keyBy(this.#providerTopics ?? [], ({ name }) => name);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);

    // Subscribe to all topics that we aren't subscribed to yet.
    for (const topicName of topicNames) {
      if (this.#topicSubscriptions.has(topicName)) {
        continue;
      }

      const availTopic = availableTopicsByTopicName[topicName];
      if (!availTopic) {
        continue;
      }

      const { schemaName } = availTopic;
      const messageReader = this.#messageReadersByDatatype[schemaName];
      if (!messageReader) {
        continue;
      }

      const problemId = `message:${topicName}`;

      this.#rosClient.addTopicCallback(topicName, (message) => {
        if (!this.#providerTopics) {
          return;
        }
        try {
          const buffer = (message as { bytes: ArrayBuffer }).bytes;
          const bytes = new Uint8Array(buffer);
          if (message._topic_type === "sensor_msgs/msg/LaserScan") {
            this.decodeLaserScanMsg(message);
          } else if (message._topic_type === "sensor_msgs/msg/Image") {
            this.decodeImageMsg(message);
          } else if (message._topic_type === "nav_msgs/msg/OccupancyGrid") {
            this.decodeOccupancyGridMsg(message);
          } else if (message._topic_type === "sensor_msgs/msg/PointCloud2") {
            this.decodePointCloud2Msg(message);
          }

          const innerMessage = message;

          // handle clock messages before choosing receiveTime so the clock can set its own receive time
          if (isClockMessage(topicName, innerMessage)) {
            const time = innerMessage.clock;
            const seconds = toSec(innerMessage.clock);
            if (!isNaN(seconds)) {
              if (this.#clockTime == undefined) {
                this.#start = time;
              }

              this.#clockTime = time;
            }
          }
          const receiveTime = this.#getCurrentTime();

          if (this.#parsedTopics.has(topicName)) {
            const msg: MessageEvent = {
              topic: topicName,
              receiveTime,
              message: innerMessage,
              schemaName,
              sizeInBytes: bytes.byteLength,
            };
            this.#parsedMessages.push(msg);
          }
          this.#problems.removeProblem(problemId);

          // Update the message count for this topic
          let stats = this.#providerTopicsStats.get(topicName);
          if (this.#topicSubscriptions.has(topicName)) {
            if (!stats) {
              stats = { numMessages: 0 };
              this.#providerTopicsStats.set(topicName, stats);
            }
            stats.numMessages++;
          }
        } catch (error) {
          this.#problems.addProblem(problemId, {
            severity: "error",
            message: `Failed to parse message on ${topicName}`,
            error,
          });
        }

        this.#emitState();
      });
      this.#topicSubscriptions.add(topicName);
    }

    // Unsubscribe from topics that we are subscribed to but shouldnt be.
    for (const topicName of this.#topicSubscriptions) {
      if (!topicNames.includes(topicName)) {
        this.#rosClient.unsubscribe(topicName);

        this.#topicSubscriptions.delete(topicName);

        // Reset the message count for this topic
        this.#providerTopicsStats.delete(topicName);
      }
    }
  }

  public setPublishers(publishers: AdvertiseOptions[]): void {
    // Since `setPublishers` is rarely called, we can get away with just throwing away the old
    // Roslib.Topic objects and creating new ones.
    for (const publisher of this.#topicPublishers.values()) {
      publisher.unadvertise();
    }
    this.#topicPublishers.clear();
    this.#advertisements = publishers;
    this.#setupPublishers();
    return;
  }

  public setParameter(_key: string, _value: ParameterValue): void {
    /* TODO */
    // Call unused variables to prevent Linting errors
    this.#topicPublishers;
    this.#advertisements;
    this.#serviceTypeCache;
    this.#getServiceType;
    this.#refreshSystemState;

    throw new Error("Parameter editing is not supported by the Rosboard connection");
  }

  public publish({ topic, msg }: PublishPayload): void {
    const publisher = this.#topicPublishers.get(topic);
    if (!publisher) {
      if (this.#advertisements.some((opts) => opts.topic === topic)) {
        // Topic was advertised but the connection is not yet established
        return;
      }
      throw new Error(
        `Tried to publish on a topic that is not registered as a publisher: ${topic}`,
      );
    }
    publisher.publish(msg);

    return;
  }

  // Query the type name for this service. Cache the query to avoid looking it up again.
  async #getServiceType(service: string): Promise<string> {
    service;
    /* (Roslibjs specific)
    if (!this.#rosClient) {
      throw new Error("Not connected");
    }

    const existing = this.#serviceTypeCache.get(service);
    if (existing) {
      return await existing;
    }

    const rosClient = this.#rosClient;
    const serviceTypePromise = new Promise<string>((resolve, reject) => {
      rosClient.getServiceType(service, resolve, reject);
    });

    this.#serviceTypeCache.set(service, serviceTypePromise);

    return await serviceTypePromise;
    */
    return "";
  }

  public async callService(service: string, request: unknown): Promise<unknown> {
    request;
    service;
    /* TODO
    if (!this.#rosClient) {
      throw new Error("Not connected");
    }

    if (!isRecord(request)) {
      throw new Error("RosboardPlayer#callService request must be an object");
    }

    const serviceType = await this.#getServiceType(service);

    // Create a proxy object for dispatching our service call
    const proxy = new roslib.Service({
      ros: this.#rosClient,
      name: service,
      serviceType,
    });

    // Send the service request
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      proxy.callService(
        request,
        (response: Record<string, unknown>) => {
          resolve(response);
        },
        (error: Error) => {
          reject(error);
        },
      );
    });
    */
    return;
  }

  // Bunch of unsupported stuff. Just don't do anything for these.
  public startPlayback(): void {
    // no-op
  }
  public pausePlayback(): void {
    // no-op
  }
  public seekPlayback(_time: Time): void {
    // no-op
  }
  public setPlaybackSpeed(_speedFraction: number): void {
    // no-op
  }
  public setGlobalVariables(): void {
    // no-op
  }

  #setupPublishers(): void {
    // This function will be called again once a connection is established
    if (!this.#rosClient) {
      return;
    }

    if (this.#advertisements.length <= 0) {
      return;
    }

    for (const { topic, schemaName: datatype } of this.#advertisements) {
      const roslibTopic = new PubTopic(this.#rosClient, topic, datatype, 0);
      this.#topicPublishers.set(topic, roslibTopic);
      roslibTopic.advertise();
    }

    return;
  }

  #addInternalSubscriptions(subscriptions: SubscribePayload[]): void {
    // Always subscribe to /clock if available
    if (subscriptions.find((sub) => sub.topic === "/clock") == undefined) {
      subscriptions.unshift({
        topic: "/clock",
      });
    }
  }

  #getCurrentTime(): Time {
    return this.#clockTime ?? fromMillis(Date.now());
  }

  // Refreshes the full system state graph. Runs in the background so we don't
  // block app startup while mapping large node graphs.
  async #refreshSystemState(): Promise<void> {
    if (this.#isRefreshing) {
      return;
    }
    return;

    /*
      const promises = nodes.map(async (node) => {
        return await new Promise<RosNodeDetails>((resolve, reject) => {
          this.#rosClient?.getNodeDetails(
            node,
            (subscriptions, publications, services) => {
              resolve({
                publications: { node, values: publications },
                services: { node, values: services },
                subscriptions: { node, values: subscriptions },
              });
            },
            reject,
          );
        });
      });

      const results = await Promise.allSettled(promises);
      const fulfilled = filterMap(results, (item) =>
        item.status === "fulfilled" ? item.value : undefined,
      );
      this.#publishedTopics = collateNodeDetails(fulfilled, "publications");
      this.#subscribedTopics = collateNodeDetails(fulfilled, "subscriptions");
      this.#services = collateNodeDetails(fulfilled, "services");

      this.#emitState();
    } catch (error) {
      this.#problems.addProblem("requestTopics:system-state", {
        severity: "error",
        message: "Failed to fetch node details from rosboard",
        error,
      });
    } finally {
      this.#isRefreshing = false;
    }
    */
  }
}

async function decodeBase64Jpeg(base64String: string, numChannels: number): Promise<Uint8Array> {
  return await new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get 2D context"));
        return;
      }

      canvas.width = img.width || 0; // Ensure width is defined or default to 0
      canvas.height = img.height || 0; // Ensure height is defined or default to 0
      ctx.drawImage(img, 0, 0);

      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const length = canvas.width * canvas.height * numChannels;
      const resultData = new Uint8Array(length);

      if (numChannels === 1) {
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          // Assuming grayscale value is taken from the red channel which is safe
          // since the original image was actually grayscale
          resultData[j] = data[i] || 0;
        }
      } else if (numChannels === 3) {
        for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
          resultData[j] = data[i] || 0;
          resultData[j + 1] = data[i + 1] || 0;
          resultData[j + 2] = data[i + 2] || 0;
        }
      } else {
        reject(new Error("Unsupported number of channels"));
        return;
      }

      resolve(resultData);
    };

    img.onerror = (error) => {
      reject(error);
    };

    img.src = `data:image/jpeg;base64,${base64String}`;
  });
}

async function decodeBase64Png(base64String: string): Promise<Uint8Array> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D context"));
        return;
      }
      canvas.width = img.width || 0; // Ensure width is defined or default to 0
      canvas.height = img.height || 0; // Ensure height is defined or default to 0
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgbData = new Uint8Array(canvas.width * canvas.height * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        rgbData[j] = data[i] || 0;
        rgbData[j + 1] = data[i + 1] || 0;
        rgbData[j + 2] = data[i + 2] || 0;
      }
      resolve(rgbData);
    };
    img.src = `data:image/png;base64,${base64String}`;
    img.onerror = (error) => {
      reject(error);
    };
  });
}
