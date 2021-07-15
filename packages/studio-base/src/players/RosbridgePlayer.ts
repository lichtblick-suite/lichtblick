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

import { isEqual, sortBy } from "lodash";
import roslib from "roslib";
import { v4 as uuidv4 } from "uuid";

import Log from "@foxglove/log";
import type { RosGraph } from "@foxglove/ros1";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";
import { Time } from "@foxglove/rostime";
import {
  AdvertisePayload,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  ParsedMessageDefinitionsByTopic,
  PlayerPresence,
  PlayerMetricsCollectorInterface,
  ParameterValue,
  PlayerProblem,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { bagConnectionsToDatatypes } from "@foxglove/studio-base/util/bagConnectionsHelper";
import debouncePromise from "@foxglove/studio-base/util/debouncePromise";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";
import {
  addTimes,
  fromMillis,
  subtractTimes,
  TimestampMethod,
  toSec,
} from "@foxglove/studio-base/util/time";

const log = Log.getLogger(__dirname);

const CAPABILITIES = [PlayerCapabilities.advertise];

// Connects to `rosbridge_server` instance using `roslibjs`. Currently doesn't support seeking or
// showing simulated time, so current time from Date.now() is always used instead. Also doesn't yet
// support raw ROS messages; instead we use the CBOR compression provided by roslibjs, which
// unmarshalls into plain JS objects.
export default class RosbridgePlayer implements Player {
  private _url: string; // WebSocket URL.
  private _rosClient?: roslib.Ros; // The roslibjs client when we're connected.
  private _id: string = uuidv4(); // Unique ID for this player.
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  private _closed: boolean = false; // Whether the player has been completely closed using close().
  private _providerTopics?: Topic[]; // Topics as published by the WebSocket.
  private _providerDatatypes?: RosDatatypes; // Datatypes as published by the WebSocket.
  private _publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  private _subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  private _services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  private _messageReadersByDatatype: {
    [datatype: string]: LazyMessageReader;
  } = {};
  private _start?: Time; // The time at which we started playing.
  private _clockTime?: Time; // The most recent published `/clock` time, if available
  private _clockReceived: Time = { sec: 0, nsec: 0 }; // The local time when `_clockTime` was last received
  // active subscriptions
  private _topicSubscriptions = new Map<string, roslib.Topic>();
  private _requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  private _messageOrder: TimestampMethod = "receiveTime";
  private _requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics().
  // active publishers for the current connection
  private _topicPublishers = new Map<string, roslib.Topic>();
  // which topics we want to advertise to other nodes
  private _advertisements: AdvertisePayload[] = [];
  private _parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};
  private _parsedTopics: Set<string> = new Set();
  private _receivedBytes: number = 0;
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _hasReceivedMessage = false;
  private _presence: PlayerPresence = PlayerPresence.NOT_PRESENT;
  private _problems: PlayerProblem[] = [];

  constructor(url: string, metricsCollector: PlayerMetricsCollectorInterface) {
    this._presence = PlayerPresence.CONSTRUCTING;
    this._metricsCollector = metricsCollector;
    this._url = url;
    this._start = fromMillis(Date.now());
    this._metricsCollector.playerConstructed();
    this._open();
  }

  _open = (): void => {
    if (this._closed) {
      return;
    }
    this._problems = [];
    log.info(`Opening connection to ${this._url}`);

    // `workersocket` will open the actual WebSocket connection in a WebWorker.
    const rosClient = new roslib.Ros({ url: this._url, transportLibrary: "workersocket" });

    rosClient.on("connection", () => {
      if (this._closed) {
        return;
      }
      this._presence = PlayerPresence.PRESENT;
      this._problems = [];
      this._rosClient = rosClient;

      this._setupPublishers();
      void this._requestTopics();
    });

    rosClient.on("error", (err) => {
      if (err) {
        this._problems.push({
          severity: "warn",
          message: "Rosbridge issue",
          error: err,
        });
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
      delete this._rosClient;

      this._problems.push({
        severity: "error",
        message: "Connection failed",
        tip: `Check that the rosbridge WebSocket server at ${this._url} is reachable.`,
      });

      this._emitState();

      // Try connecting again.
      setTimeout(this._open, 3000);
    });
  };

  _requestTopics = async (): Promise<void> => {
    // clear problems before each topics request so we don't have stale problems from previous failed requests
    this._problems = [];

    if (this._requestTopicsTimeout) {
      clearTimeout(this._requestTopicsTimeout);
    }
    const rosClient = this._rosClient;
    if (!rosClient || this._closed) {
      return;
    }

    try {
      const result = await new Promise<{
        topics: string[];
        types: string[];
        typedefs_full_text: string[];
      }>((resolve, reject) => rosClient.getTopicsAndRawTypes(resolve, reject));

      const topicsMissingDatatypes: string[] = [];
      const topics = [];
      const datatypeDescriptions = [];
      const messageReaders: Record<string, LazyMessageReader> = {};

      for (let i = 0; i < result.topics.length; i++) {
        const topicName = result.topics[i] as string;
        const type = result.types[i];
        const messageDefinition = result.typedefs_full_text[i];

        if (type == undefined || messageDefinition == undefined) {
          topicsMissingDatatypes.push(topicName);
          continue;
        }
        topics.push({ name: topicName, datatype: type });
        datatypeDescriptions.push({ type, messageDefinition });
        const parsedDefinition =
          typeof messageDefinition === "string"
            ? parseMessageDefinition(messageDefinition)
            : messageDefinition;
        messageReaders[type] = messageReaders[type] ?? new LazyMessageReader(parsedDefinition);
        this._parsedMessageDefinitionsByTopic[topicName] = parsedDefinition;
      }

      // Sort them for easy comparison. If nothing has changed here, bail out.
      const sortedTopics = sortBy(topics, "name");
      if (isEqual(sortedTopics, this._providerTopics)) {
        return;
      }

      if (topicsMissingDatatypes.length > 0) {
        this._problems.push({
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

      this._providerTopics = sortedTopics;
      this._providerDatatypes = bagConnectionsToDatatypes(datatypeDescriptions);
      this._messageReadersByDatatype = messageReaders;

      // Try subscribing again, since we might now be able to subscribe to some new topics.
      this.setSubscriptions(this._requestedSubscriptions);

      // Fetch the full graph topology
      try {
        const graph = await this._getSystemState();
        this._publishedTopics = graph.publishers;
        this._subscribedTopics = graph.subscribers;
        this._services = graph.services;
      } catch (error) {
        this._problems.push({
          severity: "error",
          message: "Failed to fetch node details from rosbridge",
        });
        this._publishedTopics = new Map();
        this._subscribedTopics = new Map();
        this._services = new Map();
      }

      this._emitState();
    } catch (error) {
      this._problems.push({
        severity: "error",
        message: "Failed to fetch topics from rosbridge",
      });
    } finally {
      // Regardless of what happens, request topics again in a little bit.
      this._requestTopicsTimeout = setTimeout(this._requestTopics, 3000);
    }
  };

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const { _providerTopics, _providerDatatypes, _start } = this;
    if (!_providerTopics || !_providerDatatypes || !_start) {
      return this._listener({
        presence: this._presence,
        progress: {},
        capabilities: CAPABILITIES,
        playerId: this._id,
        activeData: undefined,
        problems: this._problems,
      });
    }

    // When connected
    // Time is always moving forward even if we don't get messages from the server.
    if (this._presence === PlayerPresence.PRESENT) {
      setTimeout(this._emitState, 100);
    }

    const currentTime = this._getCurrentTime();
    const messages = this._parsedMessages;
    this._parsedMessages = [];
    return this._listener({
      presence: this._presence,
      progress: {},
      capabilities: CAPABILITIES,
      playerId: this._id,
      problems: this._problems,

      activeData: {
        messages,
        totalBytesReceived: this._receivedBytes,
        messageOrder: this._messageOrder,
        startTime: _start,
        endTime: currentTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        // We don't support seeking, so we need to set this to any fixed value. Just avoid 0 so
        // that we don't accidentally hit falsy checks.
        lastSeekTime: 1,
        topics: _providerTopics,
        datatypes: _providerDatatypes,
        publishedTopics: this._publishedTopics,
        subscribedTopics: this._subscribedTopics,
        services: this._services,
        parsedMessageDefinitionsByTopic: this._parsedMessageDefinitionsByTopic,
      },
    });
  });

  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  close(): void {
    this._closed = true;
    if (this._rosClient) {
      this._rosClient.close();
    }
    this._metricsCollector.close();
    this._hasReceivedMessage = false;
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._requestedSubscriptions = subscriptions;

    if (!this._rosClient || this._closed) {
      return;
    }

    // Subscribe to additional topics used by Ros1Player itself
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

      const { datatype } = availTopic;
      const messageReader = this._messageReadersByDatatype[datatype];
      if (!messageReader) {
        continue;
      }

      topic.subscribe((message) => {
        if (!this._providerTopics) {
          return;
        }

        const bytes = (message as { bytes: ArrayBuffer }).bytes;
        const receiveTime = fromMillis(Date.now());
        const innerMessage = messageReader.readMessage(Buffer.from(bytes));

        if (!this._hasReceivedMessage) {
          this._hasReceivedMessage = true;
          this._metricsCollector.recordTimeToFirstMsgs();
        }

        if (this._parsedTopics.has(topicName)) {
          const msg: MessageEvent<unknown> = {
            topic: topicName,
            receiveTime,
            message: innerMessage as never,
          };
          this._parsedMessages.push(msg);
          this._handleInternalMessage(msg);
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
      }
    }
  }

  setPublishers(publishers: AdvertisePayload[]): void {
    // Since `setPublishers` is rarely called, we can get away with just throwing away the old
    // Roslib.Topic objects and creating new ones.
    for (const publisher of this._topicPublishers.values()) {
      publisher.unadvertise();
    }
    this._topicPublishers.clear();
    this._advertisements = publishers;
    this._setupPublishers();
  }

  setParameter(_key: string, _value: ParameterValue): void {
    throw new Error("Parameter editing is not supported by the Rosbridge connection");
  }

  publish({ topic, msg }: PublishPayload): void {
    const publisher = this._topicPublishers.get(topic);
    if (!publisher) {
      throw new Error(
        `Tried to publish on a topic that is not registered as a publisher: ${topic}`,
      );
    }
    publisher.publish(msg);
  }

  // Bunch of unsupported stuff. Just don't do anything for these.
  startPlayback(): void {
    // no-op
  }
  pausePlayback(): void {
    // no-op
  }
  seekPlayback(_time: Time): void {
    // no-op
  }
  setPlaybackSpeed(_speedFraction: number): void {
    // no-op
  }
  requestBackfill(): void {
    // no-op
  }
  setGlobalVariables(): void {
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
        requester: { type: "other", name: "Ros1Player" },
      });
    }
  }

  private _handleInternalMessage(msg: MessageEvent<unknown>): void {
    const maybeClockMsg = msg.message as { clock?: Time };

    if (msg.topic === "/clock" && maybeClockMsg.clock && !isNaN(maybeClockMsg.clock?.sec)) {
      const time = maybeClockMsg.clock;
      const seconds = toSec(maybeClockMsg.clock);
      if (isNaN(seconds)) {
        return;
      }

      if (this._clockTime == undefined) {
        this._start = time;
      }

      this._clockTime = time;
      this._clockReceived = msg.receiveTime;
    }
  }

  private _getCurrentTime(): Time {
    const now = fromMillis(Date.now());
    if (this._clockTime == undefined) {
      return now;
    }

    const delta = subtractTimes(now, this._clockReceived);
    return addTimes(this._clockTime, delta);
  }

  private async _getSystemState(): Promise<RosGraph> {
    const output: RosGraph = {
      publishers: new Map<string, Set<string>>(),
      subscribers: new Map<string, Set<string>>(),
      services: new Map<string, Set<string>>(),
    };

    const addEntry = (map: Map<string, Set<string>>, key: string, value: string) => {
      let entries = map.get(key);
      if (entries == undefined) {
        entries = new Set<string>();
        map.set(key, entries);
      }
      entries.add(value);
    };

    return new Promise((resolve, reject) => {
      this._rosClient?.getNodes(async (nodes) => {
        await Promise.all(
          nodes.map((node) => {
            this._rosClient?.getNodeDetails(
              node,
              (subscriptions, publications, services) => {
                publications.forEach((pub) => addEntry(output.publishers, pub, node));
                subscriptions.forEach((sub) => addEntry(output.subscribers, sub, node));
                services.forEach((srv) => addEntry(output.services, srv, node));
              },
              reject,
            );
          }),
        );

        resolve(output);
      }, reject);
    });
  }
}
