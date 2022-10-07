// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { isEqual, sortBy, transform } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import roslib from "@foxglove/roslibjs";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";
import { MessageReader as ROS2MessageReader } from "@foxglove/rosmsg2-serialization";
import { Time, fromMillis, toSec, isGreaterThan } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  PlayerPresence,
  PlayerMetricsCollectorInterface,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { bagConnectionsToDatatypes } from "@foxglove/studio-base/util/bagConnectionsHelper";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";

const log = Log.getLogger(__dirname);

const CAPABILITIES = [PlayerCapabilities.advertise, PlayerCapabilities.callServices];

type RosNodeDetails = Record<
  "subscriptions" | "publications" | "services",
  { node: string; values: string[] }
>;

function collateNodeDetails(
  details: RosNodeDetails[],
  key: keyof RosNodeDetails,
): Map<string, Set<string>> {
  return transform(
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

function isClockMessage(topic: string, msg: unknown): msg is { clock: Time } {
  const maybeClockMsg = msg as { clock?: Time };
  return topic === "/clock" && maybeClockMsg.clock != undefined && !isNaN(maybeClockMsg.clock.sec);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined;
}

// Connects to `rosbridge_server` instance using `roslibjs`. Currently doesn't support seeking or
// showing simulated time, so current time from Date.now() is always used instead. Also doesn't yet
// support raw ROS messages; instead we use the CBOR compression provided by roslibjs, which
// unmarshalls into plain JS objects.
export default class RosbridgePlayer implements Player {
  private _url: string; // WebSocket URL.
  private _rosClient?: roslib.Ros; // The roslibjs client when we're connected.
  private _id: string = uuidv4(); // Unique ID for this player.
  private _isRefreshing = false; // True if currently refreshing the node graph.
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  private _closed: boolean = false; // Whether the player has been completely closed using close().
  private _providerTopics?: Topic[]; // Topics as published by the WebSocket.
  private _providerTopicsStats = new Map<string, TopicStats>(); // topic names to topic statistics.
  private _providerDatatypes?: RosDatatypes; // Datatypes as published by the WebSocket.
  private _publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  private _subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  private _services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  private _messageReadersByDatatype: {
    [datatype: string]: LazyMessageReader | ROS2MessageReader;
  } = {};
  private _start?: Time; // The time at which we started playing.
  private _clockTime?: Time; // The most recent published `/clock` time, if available
  // active subscriptions
  private _topicSubscriptions = new Map<string, roslib.Topic>();
  private _requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  private _requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics().
  // active publishers for the current connection
  private _topicPublishers = new Map<string, roslib.Topic>();
  // which topics we want to advertise to other nodes
  private _advertisements: AdvertiseOptions[] = [];
  private _parsedTopics: Set<string> = new Set();
  private _receivedBytes: number = 0;
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _hasReceivedMessage = false;
  private _presence: PlayerPresence = PlayerPresence.NOT_PRESENT;
  private _problems = new PlayerProblemManager();
  private _emitTimer?: ReturnType<typeof setTimeout>;
  private _serviceTypeCache = new Map<string, Promise<string>>();
  private readonly _sourceId: string;
  private _rosVersion: 1 | 2 | undefined;

  public constructor({
    url,
    metricsCollector,
    sourceId,
  }: {
    url: string;
    metricsCollector: PlayerMetricsCollectorInterface;
    sourceId: string;
  }) {
    this._presence = PlayerPresence.INITIALIZING;
    this._metricsCollector = metricsCollector;
    this._url = url;
    this._start = fromMillis(Date.now());
    this._metricsCollector.playerConstructed();
    this._sourceId = sourceId;
    this._open();
  }

  private _open = (): void => {
    if (this._closed) {
      return;
    }
    if (this._rosClient != undefined) {
      throw new Error(`Attempted to open a second Rosbridge connection`);
    }
    this._problems.removeProblem("rosbridge:connection-failed");
    log.info(`Opening connection to ${this._url}`);

    // `workersocket` will open the actual WebSocket connection in a WebWorker.
    const rosClient = new roslib.Ros({ url: this._url, transportLibrary: "workersocket" });

    rosClient.on("connection", () => {
      log.info(`Connected to ${this._url}`);
      if (this._closed) {
        return;
      }
      this._presence = PlayerPresence.PRESENT;
      this._problems.removeProblem("rosbridge:connection-failed");
      this._rosClient = rosClient;

      this._setupPublishers();
      void this._requestTopics({ forceUpdate: true });
    });

    rosClient.on("error", (err) => {
      if (err) {
        this._problems.addProblem("rosbridge:error", {
          severity: "warn",
          message: "Rosbridge error",
          error: err,
        });
        this._emitState();
      }
    });

    rosClient.on("close", () => {
      this._presence = PlayerPresence.RECONNECTING;

      if (this._requestTopicsTimeout) {
        clearTimeout(this._requestTopicsTimeout);
      }
      for (const [topicName, topic] of this._topicSubscriptions) {
        topic.unsubscribe();
        this._topicSubscriptions.delete(topicName);
      }
      rosClient.close(); // ensure the underlying worker is cleaned up
      delete this._rosClient;

      this._problems.addProblem("rosbridge:connection-failed", {
        severity: "error",
        message: "Connection failed",
        tip: `Check that the rosbridge WebSocket server at ${this._url} is reachable.`,
      });

      this._emitState();

      // Try connecting again.
      setTimeout(this._open, 3000);
    });
  };

  private _topicsChanged = (newTopics: Topic[]): boolean => {
    if (!this._providerTopics || newTopics.length !== this._providerTopics.length) {
      return true;
    }
    return !isEqual(this._providerTopics, newTopics);
  };

  private async _requestTopics(opt?: { forceUpdate: boolean }): Promise<void> {
    const { forceUpdate = false } = opt ?? {};
    // clear problems before each topics request so we don't have stale problems from previous failed requests
    this._problems.removeProblems((id) => id.startsWith("requestTopics:"));

    if (this._requestTopicsTimeout) {
      clearTimeout(this._requestTopicsTimeout);
    }
    const rosClient = this._rosClient;
    if (!rosClient || this._closed) {
      return;
    }

    // getTopicsAndRawTypes might silently hang. When this happens, there is no indication to the user
    // that the connection is doing anything and studio shows no errors and no data.
    // This logic adds a warning after 5 seconds (picked arbitrarily) to display a notice to the user.
    const topicsStallWarningTimeout = setTimeout(() => {
      this._problems.addProblem("topicsAndRawTypesTimeout", {
        severity: "warn",
        message: "Taking too long to get topics and raw types.",
      });

      this._emitState();
    }, 5000);

    try {
      const result = await new Promise<{
        topics: string[];
        types: string[];
        typedefs_full_text: string[];
      }>((resolve, reject) => rosClient.getTopicsAndRawTypes(resolve, reject));

      clearTimeout(topicsStallWarningTimeout);
      this._problems.removeProblem("topicsAndRawTypesTimeout");

      const topicsMissingDatatypes: string[] = [];
      const topics: Topic[] = [];
      const datatypeDescriptions = [];
      const messageReaders: Record<string, LazyMessageReader | ROS2MessageReader> = {};

      // Automatically detect the ROS version based on the datatypes.
      // The rosbridge server itself publishes /rosout so the topic should be reliably present.
      if (result.types.includes("rcl_interfaces/msg/Log")) {
        this._rosVersion = 2;
        this._problems.removeProblem("unknownRosVersion");
      } else if (result.types.includes("rosgraph_msgs/Log")) {
        this._rosVersion = 1;
        this._problems.removeProblem("unknownRosVersion");
      } else {
        this._rosVersion = 1;
        this._problems.addProblem("unknownRosVersion", {
          severity: "warn",
          message: "Unable to detect ROS version, assuming ROS 1",
        });
      }

      for (let i = 0; i < result.topics.length; i++) {
        const topicName = result.topics[i]!;
        const type = result.types[i];
        const messageDefinition = result.typedefs_full_text[i];

        if (type == undefined || messageDefinition == undefined) {
          topicsMissingDatatypes.push(topicName);
          continue;
        }
        topics.push({ name: topicName, schemaName: type });
        datatypeDescriptions.push({ type, messageDefinition });
        const parsedDefinition = parseMessageDefinition(messageDefinition, {
          ros2: this._rosVersion === 2,
        });
        messageReaders[type] ??=
          this._rosVersion !== 2
            ? new LazyMessageReader(parsedDefinition)
            : new ROS2MessageReader(parsedDefinition);
      }

      // We call requestTopics on a timeout to check for new topics. If there are no changes to topics
      // we want to bail and avoid updating readers, subscribers, etc.
      // However, during a re-connect, we _do_ want to refresh this list and re-subscribe
      const sortedTopics = sortBy(topics, "name");
      if (!forceUpdate && !this._topicsChanged(sortedTopics)) {
        return;
      }

      if (topicsMissingDatatypes.length > 0) {
        this._problems.addProblem("requestTopics:missing-types", {
          severity: "warn",
          message: "Could not resolve all message types",
          tip: `Message types could not be found for these topics: ${topicsMissingDatatypes.join(
            ",",
          )}`,
        });
      }

      if (this._providerTopics == undefined) {
        this._metricsCollector.initialized();
      }

      // Remove stats entries for removed topics
      const topicsSet = new Set<string>(topics.map((topic) => topic.name));
      for (const topic of this._providerTopicsStats.keys()) {
        if (!topicsSet.has(topic)) {
          this._providerTopicsStats.delete(topic);
        }
      }

      this._providerTopics = sortedTopics;

      this._providerDatatypes = bagConnectionsToDatatypes(datatypeDescriptions, {
        ros2: this._rosVersion === 2,
      });
      this._messageReadersByDatatype = messageReaders;

      // Try subscribing again, since we might now be able to subscribe to some new topics.
      this.setSubscriptions(this._requestedSubscriptions);

      // Refresh the full graph topology
      this._refreshSystemState().catch((error) => log.error(error));
    } catch (error) {
      log.error(error);
      clearTimeout(topicsStallWarningTimeout);
      this._problems.removeProblem("topicsAndRawTypesTimeout");

      this._problems.addProblem("requestTopics:error", {
        severity: "error",
        message: "Failed to fetch topics from rosbridge",
        error,
      });
    } finally {
      this._emitState();

      // Regardless of what happens, request topics again in a little bit.
      this._requestTopicsTimeout = setTimeout(() => void this._requestTopics(), 3000);
    }
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  private _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const { _providerTopics, _providerDatatypes, _start } = this;
    if (!_providerTopics || !_providerDatatypes || !_start) {
      return this._listener({
        name: this._url,
        presence: this._presence,
        progress: {},
        capabilities: CAPABILITIES,
        profile: undefined,
        playerId: this._id,
        activeData: undefined,
        problems: this._problems.problems(),
        urlState: {
          sourceId: this._sourceId,
          parameters: { url: this._url },
        },
      });
    }

    // When connected
    // Time is always moving forward even if we don't get messages from the server.
    if (this._presence === PlayerPresence.PRESENT) {
      if (this._emitTimer != undefined) {
        clearTimeout(this._emitTimer);
      }
      this._emitTimer = setTimeout(this._emitState, 100);
    }

    const currentTime = this._getCurrentTime();
    const messages = this._parsedMessages;
    this._parsedMessages = [];
    return this._listener({
      name: this._url,
      presence: this._presence,
      progress: {},
      capabilities: CAPABILITIES,
      profile: this._rosVersion === 2 ? "ros2" : "ros1",
      playerId: this._id,
      problems: this._problems.problems(),
      urlState: {
        sourceId: this._sourceId,
        parameters: { url: this._url },
      },

      activeData: {
        messages,
        totalBytesReceived: this._receivedBytes,
        startTime: _start,
        endTime: currentTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        // We don't support seeking, so we need to set this to any fixed value. Just avoid 0 so
        // that we don't accidentally hit falsy checks.
        lastSeekTime: 1,
        topics: _providerTopics,
        // Always copy topic stats since message counts and timestamps are being updated
        topicStats: new Map(this._providerTopicsStats),
        datatypes: _providerDatatypes,
        publishedTopics: this._publishedTopics,
        subscribedTopics: this._subscribedTopics,
        services: this._services,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  public close(): void {
    this._closed = true;
    if (this._rosClient) {
      this._rosClient.close();
    }
    if (this._emitTimer != undefined) {
      clearTimeout(this._emitTimer);
      this._emitTimer = undefined;
    }
    this._metricsCollector.close();
    this._hasReceivedMessage = false;
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._requestedSubscriptions = subscriptions;

    if (!this._rosClient || this._closed) {
      return;
    }

    // Subscribe to additional topics used by RosbridgePlayer itself
    this._addInternalSubscriptions(subscriptions);

    this._parsedTopics = new Set(subscriptions.map(({ topic }) => topic));

    // See what topics we actually can subscribe to.
    const availableTopicsByTopicName = getTopicsByTopicName(this._providerTopics ?? []);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);

    // Subscribe to all topics that we aren't subscribed to yet.
    for (const topicName of topicNames) {
      if (this._topicSubscriptions.has(topicName)) {
        continue;
      }
      const topic = new roslib.Topic({
        ros: this._rosClient,
        name: topicName,
        compression: "cbor-raw",
      });
      const availTopic = availableTopicsByTopicName[topicName];
      if (!availTopic) {
        continue;
      }

      const { schemaName: datatype } = availTopic;
      const messageReader = this._messageReadersByDatatype[datatype];
      if (!messageReader) {
        continue;
      }

      const problemId = `message:${topicName}`;
      topic.subscribe((message) => {
        if (!this._providerTopics) {
          return;
        }
        try {
          const buffer = (message as { bytes: ArrayBuffer }).bytes;
          const bytes = new Uint8Array(buffer);

          // This conditional can be removed when the ROS2 deserializer supports size()
          if (messageReader instanceof LazyMessageReader) {
            const msgSize = messageReader.size(bytes);
            if (msgSize > bytes.byteLength) {
              this._problems.addProblem(problemId, {
                severity: "error",
                message: `Message buffer not large enough on ${topicName}`,
                error: new Error(
                  `Cannot read ${msgSize} byte message from ${bytes.byteLength} byte buffer`,
                ),
              });
              this._emitState();
              return;
            }
          }

          const innerMessage = messageReader.readMessage(bytes);

          // handle clock messages before choosing receiveTime so the clock can set its own receive time
          if (isClockMessage(topicName, innerMessage)) {
            const time = innerMessage.clock;
            const seconds = toSec(innerMessage.clock);
            if (!isNaN(seconds)) {
              if (this._clockTime == undefined) {
                this._start = time;
              }

              this._clockTime = time;
            }
          }
          const receiveTime = this._getCurrentTime();

          if (!this._hasReceivedMessage) {
            this._hasReceivedMessage = true;
            this._metricsCollector.recordTimeToFirstMsgs();
          }

          if (this._parsedTopics.has(topicName)) {
            const msg: MessageEvent<unknown> = {
              topic: topicName,
              receiveTime,
              message: innerMessage,
              schemaName: datatype,
              sizeInBytes: bytes.byteLength,
            };
            this._parsedMessages.push(msg);
          }
          this._problems.removeProblem(problemId);

          // Update the message count for this topic
          let stats = this._providerTopicsStats.get(topicName);
          if (this._topicSubscriptions.has(topicName)) {
            if (!stats) {
              stats = { numMessages: 0 };
              this._providerTopicsStats.set(topicName, stats);
            }
            stats.numMessages++;
            stats.firstMessageTime ??= receiveTime;
            if (stats.lastMessageTime == undefined) {
              stats.lastMessageTime = receiveTime;
            } else if (isGreaterThan(receiveTime, stats.lastMessageTime)) {
              stats.lastMessageTime = receiveTime;
            }
          }
        } catch (error) {
          this._problems.addProblem(problemId, {
            severity: "error",
            message: `Failed to parse message on ${topicName}`,
            error,
          });
        }

        this._emitState();
      });
      this._topicSubscriptions.set(topicName, topic);
    }

    // Unsubscribe from topics that we are subscribed to but shouldn't be.
    for (const [topicName, topic] of this._topicSubscriptions) {
      if (!topicNames.includes(topicName)) {
        topic.unsubscribe();
        this._topicSubscriptions.delete(topicName);

        // Reset the message count for this topic
        this._providerTopicsStats.delete(topicName);
      }
    }
  }

  public setPublishers(publishers: AdvertiseOptions[]): void {
    // Since `setPublishers` is rarely called, we can get away with just throwing away the old
    // Roslib.Topic objects and creating new ones.
    for (const publisher of this._topicPublishers.values()) {
      publisher.unadvertise();
    }
    this._topicPublishers.clear();
    this._advertisements = publishers;
    this._setupPublishers();
  }

  public setParameter(_key: string, _value: ParameterValue): void {
    throw new Error("Parameter editing is not supported by the Rosbridge connection");
  }

  public publish({ topic, msg }: PublishPayload): void {
    const publisher = this._topicPublishers.get(topic);
    if (!publisher) {
      throw new Error(
        `Tried to publish on a topic that is not registered as a publisher: ${topic}`,
      );
    }
    publisher.publish(msg);
  }

  // Query the type name for this service. Cache the query to avoid looking it up again.
  private async getServiceType(service: string): Promise<string> {
    if (!this._rosClient) {
      throw new Error("Not connected");
    }

    const existing = this._serviceTypeCache.get(service);
    if (existing) {
      return await existing;
    }

    const rosClient = this._rosClient;
    const serviceTypePromise = new Promise<string>((resolve, reject) => {
      rosClient.getServiceType(service, resolve, reject);
    });

    this._serviceTypeCache.set(service, serviceTypePromise);

    return await serviceTypePromise;
  }

  public async callService(service: string, request: unknown): Promise<unknown> {
    if (!this._rosClient) {
      throw new Error("Not connected");
    }

    if (!isRecord(request)) {
      throw new Error("RosbridgePlayer#callService request must be an object");
    }

    const serviceType = await this.getServiceType(service);

    // Create a proxy object for dispatching our service call
    const proxy = new roslib.Service({
      ros: this._rosClient,
      name: service,
      serviceType,
    });

    // Send the service request
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      proxy.callService(
        request,
        (response: Record<string, unknown>) => resolve(response),
        (error: Error) => reject(error),
      );
    });
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

  private _setupPublishers(): void {
    // This function will be called again once a connection is established
    if (!this._rosClient) {
      return;
    }

    if (this._advertisements.length <= 0) {
      return;
    }

    for (const { topic, datatype } of this._advertisements) {
      this._topicPublishers.set(
        topic,
        new roslib.Topic({
          ros: this._rosClient,
          name: topic,
          messageType: datatype,
          queue_size: 0,
        }),
      );
    }
  }

  private _addInternalSubscriptions(subscriptions: SubscribePayload[]): void {
    // Always subscribe to /clock if available
    if (subscriptions.find((sub) => sub.topic === "/clock") == undefined) {
      subscriptions.unshift({
        topic: "/clock",
      });
    }
  }

  private _getCurrentTime(): Time {
    return this._clockTime ?? fromMillis(Date.now());
  }

  // Refreshes the full system state graph. Runs in the background so we don't
  // block app startup while mapping large node graphs.
  private async _refreshSystemState(): Promise<void> {
    if (this._isRefreshing) {
      return;
    }

    try {
      this._isRefreshing = true;

      const nodes = await new Promise<string[]>((resolve, reject) => {
        this._rosClient?.getNodes((fetchedNodes) => resolve(fetchedNodes), reject);
      });

      const promises = nodes.map(async (node) => {
        return await new Promise<RosNodeDetails>((resolve, reject) => {
          this._rosClient?.getNodeDetails(
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
      this._publishedTopics = collateNodeDetails(fulfilled, "publications");
      this._subscribedTopics = collateNodeDetails(fulfilled, "subscriptions");
      this._services = collateNodeDetails(fulfilled, "services");

      this._emitState();
    } catch (error) {
      this._problems.addProblem("requestTopics:system-state", {
        severity: "error",
        message: "Failed to fetch node details from rosbridge",
        error,
      });
    } finally {
      this._isRefreshing = false;
    }
  }
}
