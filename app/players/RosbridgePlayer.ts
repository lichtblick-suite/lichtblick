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
import { MessageReader, Time, parseMessageDefinition } from "rosbag";
import roslib from "roslib";
import { v4 as uuidv4 } from "uuid";

import {
  AdvertisePayload,
  Message,
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
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { bagConnectionsToDatatypes } from "@foxglove-studio/app/util/bagConnectionsHelper";
import debouncePromise from "@foxglove-studio/app/util/debouncePromise";
import { FREEZE_MESSAGES } from "@foxglove-studio/app/util/globalConstants";
import { getTopicsByTopicName } from "@foxglove-studio/app/util/selectors";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import {
  addTimes,
  fromMillis,
  subtractTimes,
  TimestampMethod,
  toSec,
} from "@foxglove-studio/app/util/time";
import type { RosGraph } from "@foxglove/ros1";

const CAPABILITIES = [PlayerCapabilities.advertise];
const NO_WARNINGS = Object.freeze({});

// Connects to `rosbridge_server` instance using `roslibjs`. Currently doesn't support seeking or
// showing simulated time, so current time from Date.now() is always used instead. Also doesn't yet
// support raw ROS messages; instead we use the CBOR compression provided by roslibjs, which
// unmarshalls into plain JS objects.
export default class RosbridgePlayer implements Player {
  _url: string; // WebSocket URL.
  _rosClient?: roslib.Ros; // The roslibjs client when we're connected.
  _id: string = uuidv4(); // Unique ID for this player.
  _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  _closed: boolean = false; // Whether the player has been completely closed using close().
  _providerTopics?: Topic[]; // Topics as published by the WebSocket.
  _providerDatatypes?: RosDatatypes; // Datatypes as published by the WebSocket.
  _publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  _subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  _services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  _messageReadersByDatatype: {
    [datatype: string]: MessageReader;
  } = {};
  _start?: Time; // The time at which we started playing.
  _clockTime?: Time; // The most recent published `/clock` time, if available
  _clockReceived: Time = { sec: 0, nsec: 0 }; // The local time when `_clockTime` was last received
  // active subscriptions
  _topicSubscriptions = new Map<string, roslib.Topic>();
  _requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  _parsedMessages: Message[] = []; // Queue of messages that we'll send in next _emitState() call.
  _messageOrder: TimestampMethod = "receiveTime";
  _requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics().
  _topicPublishers: {
    [topicName: string]: roslib.Topic;
  } = {};
  _parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};
  _parsedTopics: Set<string> = new Set();
  _receivedBytes: number = 0;
  _metricsCollector: PlayerMetricsCollectorInterface;
  _hasReceivedMessage = false;
  _sentConnectionClosedNotification = false;
  _sentTopicsErrorNotification = false;
  _sentNodesErrorNotification = false;

  constructor(url: string, metricsCollector: PlayerMetricsCollectorInterface) {
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

    // `workersocket` will open the actual WebSocket connection in a WebWorker.
    const rosClient = new roslib.Ros({ url: this._url, transportLibrary: "workersocket" });

    rosClient.on("connection", () => {
      if (this._closed) {
        return;
      }
      this._rosClient = rosClient;
      this._requestTopics();
    });

    rosClient.on("error", (error) => {
      // TODO(JP): Figure out which kinds of errors we can get here, and which ones we should
      // actually show to the user.
      // The "workersocket" transport just sends `null` as the error data: https://github.com/RobotWebTools/roslibjs/blob/6c17327cae14ca0c76ca5f71de5661279207219c/src/util/workerSocket.js#L27
      console.warn("WebSocket error", error);
    });

    rosClient.on("close", () => {
      if (this._requestTopicsTimeout) {
        clearTimeout(this._requestTopicsTimeout);
      }
      for (const [topicName, topic] of this._topicSubscriptions) {
        topic.unsubscribe();
        this._topicSubscriptions.delete(topicName);
      }
      delete this._rosClient;
      this._emitState();

      if (!this._sentConnectionClosedNotification) {
        this._sentConnectionClosedNotification = true;
        sendNotification(
          "Rosbridge connection failed",
          `Check that the rosbridge WebSocket server at ${this._url} is reachable.`,
          "user",
          "error",
        );
      }
      // Try connecting again.
      setTimeout(this._open, 3000);
    });
  };

  _requestTopics = async (): Promise<void> => {
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
      const messageReaders: Record<string, MessageReader> = {};

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
        messageReaders[type] =
          messageReaders[type] ?? new MessageReader(parsedDefinition, { freeze: FREEZE_MESSAGES });
        this._parsedMessageDefinitionsByTopic[topicName] = parsedDefinition;
      }

      // Sort them for easy comparison. If nothing has changed here, bail out.
      const sortedTopics = sortBy(topics, "name");
      if (isEqual(sortedTopics, this._providerTopics)) {
        return;
      }

      if (topicsMissingDatatypes.length > 0) {
        sendNotification(
          "Could not resolve all message types",
          `This can happen e.g. when playing a bag from a different codebase. Message types could not be found for these topics:\n${topicsMissingDatatypes.join(
            "\n",
          )}`,
          "user",
          "warn",
        );
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
        if (!this._sentNodesErrorNotification) {
          this._sentNodesErrorNotification = true;
          sendNotification("Failed to fetch node details from rosbridge", error, "user", "warn");
        }
        this._publishedTopics = new Map();
        this._subscribedTopics = new Map();
        this._services = new Map();
      }

      this._emitState();
    } catch (error) {
      if (!this._sentTopicsErrorNotification) {
        this._sentTopicsErrorNotification = true;
        sendNotification("Failed to fetch topics from rosbridge", error, "user", "error");
      }
    } finally {
      // Regardless of what happens, request topics again in a little bit.
      this._requestTopicsTimeout = setTimeout(this._requestTopics, 3000);
    }
  };

  _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const { _providerTopics, _providerDatatypes, _start } = this;
    if (!_providerTopics || !_providerDatatypes || !_start) {
      return this._listener({
        presence: PlayerPresence.INITIALIZING,
        progress: {},
        capabilities: CAPABILITIES,
        playerId: this._id,
        activeData: undefined,
      });
    }

    // Time is always moving forward even if we don't get messages from the server.
    setTimeout(this._emitState, 100);

    const currentTime = this._getCurrentTime();
    const messages = this._parsedMessages;
    this._parsedMessages = [];
    return this._listener({
      presence: PlayerPresence.PRESENT,
      progress: {},
      capabilities: CAPABILITIES,
      playerId: this._id,

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
        playerWarnings: NO_WARNINGS,
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

      topic.subscribe((message: any) => {
        if (!this._providerTopics) {
          return;
        }

        const receiveTime = fromMillis(Date.now());
        const innerMessage = messageReader.readMessage(Buffer.from(message.bytes));

        if (!this._hasReceivedMessage) {
          this._hasReceivedMessage = true;
          this._metricsCollector.recordTimeToFirstMsgs();
        }

        if (this._parsedTopics.has(topicName)) {
          const msg: Message = {
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
    for (const publisher of Object.values(this._topicPublishers)) {
      publisher.unadvertise();
    }
    this._topicPublishers = {};

    if (publishers.length > 0) {
      if (!this._rosClient) {
        throw new Error("RosbridgePlayer not connected");
      }
      for (const { topic, datatype } of publishers) {
        this._topicPublishers[topic] = new roslib.Topic({
          ros: this._rosClient,
          name: topic,
          messageType: datatype,
          queue_size: 0,
        });
      }
    }
  }

  setParameter(key: string, _value: ParameterValue): void {
    sendNotification(
      "Parameter editing unsupported",
      `Cannot set parameter "${key}" with rosbridge, parameter editing is not supported`,
      "app",
      "error",
    );
  }

  publish({ topic, msg }: PublishPayload): void {
    const subscription = this._topicSubscriptions.get(topic);
    if (!subscription) {
      sendNotification(
        "Invalid publish call",
        `Tried to publish on a topic that is not registered as a publisher: ${topic}`,
        "app",
        "error",
      );
      return;
    }
    subscription.publish(msg);
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

  private _addInternalSubscriptions(subscriptions: SubscribePayload[]): void {
    // Always subscribe to /clock if available
    if (subscriptions.find((sub) => sub.topic === "/clock") === undefined) {
      subscriptions.unshift({
        topic: "/clock",
        requester: { type: "other", name: "Ros1Player" },
      });
    }
  }

  private _handleInternalMessage(msg: Message): void {
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
