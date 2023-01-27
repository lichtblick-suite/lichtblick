// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";
import { isEqual } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import Log from "@foxglove/log";
import { parseChannel, ParsedChannel } from "@foxglove/mcap-support";
import { RosMsgDefinition } from "@foxglove/rosmsg";
import CommonRosTypes from "@foxglove/rosmsg-msgs-common";
import { MessageWriter as Ros1MessageWriter } from "@foxglove/rosmsg-serialization";
import { MessageWriter as Ros2MessageWriter } from "@foxglove/rosmsg2-serialization";
import { fromMillis, fromNanoSec, isGreaterThan, isLessThan, Time } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import rosDatatypesToMessageDefinition from "@foxglove/studio-base/util/rosDatatypesToMessageDefinition";
import {
  Channel,
  ChannelId,
  ClientChannel,
  FoxgloveClient,
  ServerCapability,
  SubscriptionId,
} from "@foxglove/ws-protocol";

import WorkerSocketAdapter from "./WorkerSocketAdapter";

const log = Log.getLogger(__dirname);

/** Suppress warnings about messages on unknown subscriptions if the susbscription was recently canceled. */
const SUBSCRIPTION_WARNING_SUPPRESSION_MS = 2000;

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });
const GET_ALL_PARAMS_REQUEST_ID = "get-all-params";
const GET_ALL_PARAMS_PERIOD_MS = 15000;
const ROS_ENCODINGS = ["ros1", "cdr"];
const SUPPORTED_PUBLICATION_ENCODINGS = ["json", ...ROS_ENCODINGS];
const FALLBACK_PUBLICATION_ENCODING = "json";

type ResolvedChannel = { channel: Channel; parsedChannel: ParsedChannel };
type Publication = ClientChannel & { messageWriter?: Ros1MessageWriter | Ros2MessageWriter };

export default class FoxgloveWebSocketPlayer implements Player {
  private _url: string; // WebSocket URL.
  private _name: string;
  private _client?: FoxgloveClient; // The client when we're connected.
  private _id: string = uuidv4(); // Unique ID for this player.
  private _serverCapabilities: string[] = [];
  private _playerCapabilities: (typeof PlayerCapabilities)[keyof typeof PlayerCapabilities][] = [];
  private _supportedEncodings?: string[];
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  private _closed: boolean = false; // Whether the player has been completely closed using close().
  private _topics?: Topic[]; // Topics as published by the WebSocket.
  private _topicsStats = new Map<string, TopicStats>(); // Topic names to topic statistics.
  private _datatypes?: RosDatatypes; // Datatypes as published by the WebSocket.
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  private _receivedBytes: number = 0;
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _hasReceivedMessage = false;
  private _presence: PlayerPresence = PlayerPresence.NOT_PRESENT;
  private _problems = new PlayerProblemManager();
  private _numTimeSeeks = 0;

  /** Earliest time seen */
  private _startTime?: Time;
  /** Latest time seen */
  private _endTime?: Time;
  /* The most recent published time, if available */
  private _clockTime?: Time;
  /* Flag indicating if the server publishes time messages */
  private _serverPublishesTime = false;

  private _unresolvedSubscriptions = new Set<string>();
  private _resolvedSubscriptionsByTopic = new Map<string, SubscriptionId>();
  private _resolvedSubscriptionsById = new Map<SubscriptionId, ResolvedChannel>();
  private _channelsByTopic = new Map<string, ResolvedChannel>();
  private _channelsById = new Map<ChannelId, ResolvedChannel>();
  private _unsupportedChannelIds = new Set<ChannelId>();
  private _recentlyCanceledSubscriptions = new Set<SubscriptionId>();
  private _parameters = new Map<string, ParameterValue>();
  private readonly _sourceId: string;
  private _getParameterInterval?: ReturnType<typeof setInterval>;
  private _unresolvedPublications: AdvertiseOptions[] = [];
  private _publicationsByTopic = new Map<string, Publication>();

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
    this._name = url;
    this._metricsCollector.playerConstructed();
    this._sourceId = sourceId;
    this._open();
  }

  private _open = (): void => {
    if (this._closed) {
      return;
    }
    if (this._client != undefined) {
      throw new Error(`Attempted to open a second Foxglove WebSocket connection`);
    }
    log.info(`Opening connection to ${this._url}`);

    this._client = new FoxgloveClient({
      ws:
        typeof Worker !== "undefined"
          ? new WorkerSocketAdapter(this._url, [FoxgloveClient.SUPPORTED_SUBPROTOCOL])
          : new WebSocket(this._url, [FoxgloveClient.SUPPORTED_SUBPROTOCOL]),
    });

    this._client.on("open", () => {
      if (this._closed) {
        return;
      }
      this._presence = PlayerPresence.PRESENT;
      this._problems.clear();
      this._channelsById.clear();
      this._channelsByTopic.clear();
      this._setupPublishers();
    });

    this._client.on("error", (err) => {
      log.error(err);
    });

    this._client.on("close", (event) => {
      log.info("Connection closed:", event);
      this._presence = PlayerPresence.RECONNECTING;
      this._startTime = undefined;
      this._endTime = undefined;
      this._clockTime = undefined;
      this._serverPublishesTime = false;
      this._serverCapabilities = [];
      this._playerCapabilities = [];
      this._supportedEncodings = undefined;
      this._datatypes = undefined;

      for (const topic of this._resolvedSubscriptionsByTopic.keys()) {
        this._unresolvedSubscriptions.add(topic);
      }
      this._resolvedSubscriptionsById.clear();
      this._resolvedSubscriptionsByTopic.clear();
      this._parameters.clear();
      if (this._getParameterInterval != undefined) {
        clearInterval(this._getParameterInterval);
      }
      this._client?.close();
      delete this._client;

      this._problems.addProblem("ws:connection-failed", {
        severity: "error",
        message: "Connection failed",
        tip: `Check that the WebSocket server at ${this._url} is reachable and supports protocol version ${FoxgloveClient.SUPPORTED_SUBPROTOCOL}.`,
      });

      this._emitState();

      // Try connecting again.
      setTimeout(this._open, 3000);
    });

    this._client.on("serverInfo", (event) => {
      if (!Array.isArray(event.capabilities)) {
        this._problems.addProblem("ws:invalid-capabilities", {
          severity: "warn",
          message: `Server sent an invalid or missing capabilities field: '${event.capabilities}'`,
        });
      }
      this._name = `${this._url}\n${event.name}`;
      this._serverCapabilities = Array.isArray(event.capabilities) ? event.capabilities : [];
      this._serverPublishesTime = this._serverCapabilities.includes(ServerCapability.time);
      this._supportedEncodings = event.supportedEncodings;
      this._datatypes = new Map();

      if (event.metadata != undefined && "ROS_DISTRO" in event.metadata) {
        // Add common ROS message definitions
        const rosDistro = event.metadata["ROS_DISTRO"] as string;
        const rosDataTypes = ["melodic", "noetic"].includes(rosDistro)
          ? CommonRosTypes.ros1
          : ["foxy", "galactic"].includes(rosDistro)
          ? CommonRosTypes.ros2galactic
          : CommonRosTypes.ros2humble;

        for (const dataType in rosDataTypes) {
          const msgDef = (rosDataTypes as Record<string, RosMsgDefinition>)[dataType]!;
          this._datatypes.set(dataType, msgDef);
          this._datatypes.set(dataTypeToFullName(dataType), msgDef);
        }
      }

      if (event.capabilities.includes(ServerCapability.clientPublish)) {
        this._playerCapabilities.push(PlayerCapabilities.advertise);
      }

      if (event.capabilities.includes(ServerCapability.parameters)) {
        this._playerCapabilities.push(
          PlayerCapabilities.getParameters,
          PlayerCapabilities.setParameters,
        );

        // Periodically request all available parameters.
        this._getParameterInterval = setInterval(() => {
          this._client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
        }, GET_ALL_PARAMS_PERIOD_MS);

        this._client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
      }

      this._emitState();
    });

    this._client.on("status", (event) => {
      log.info("Status:", event);
    });

    this._client.on("advertise", (newChannels) => {
      for (const channel of newChannels) {
        let parsedChannel;
        try {
          let schemaEncoding;
          let schemaData;
          if (channel.encoding === "json") {
            schemaEncoding = "jsonschema";
            schemaData = new TextEncoder().encode(channel.schema);
          } else if (channel.encoding === "protobuf") {
            schemaEncoding = "protobuf";
            schemaData = new Uint8Array(base64.length(channel.schema));
            if (base64.decode(channel.schema, schemaData, 0) !== schemaData.byteLength) {
              throw new Error(`Failed to decode base64 schema on channel ${channel.id}`);
            }
          } else if (channel.encoding === "flatbuffer") {
            schemaEncoding = "flatbuffer";
            schemaData = new Uint8Array(base64.length(channel.schema));
            if (base64.decode(channel.schema, schemaData, 0) !== schemaData.byteLength) {
              throw new Error(`Failed to decode base64 schema on channel ${channel.id}`);
            }
          } else if (channel.encoding === "ros1") {
            schemaEncoding = "ros1msg";
            schemaData = new TextEncoder().encode(channel.schema);
          } else if (channel.encoding === "cdr") {
            schemaEncoding = "ros2msg";
            schemaData = new TextEncoder().encode(channel.schema);
          } else {
            throw new Error(`Unsupported encoding ${channel.encoding}`);
          }
          parsedChannel = parseChannel({
            messageEncoding: channel.encoding,
            schema: { name: channel.schemaName, encoding: schemaEncoding, data: schemaData },
          });
        } catch (error) {
          this._unsupportedChannelIds.add(channel.id);
          this._problems.addProblem(`schema:${channel.topic}`, {
            severity: "error",
            message: `Failed to parse channel schema on ${channel.topic}`,
            error,
          });
          this._emitState();
          continue;
        }
        const existingChannel = this._channelsByTopic.get(channel.topic);
        if (existingChannel && !isEqual(channel, existingChannel.channel)) {
          this._problems.addProblem(`duplicate-topic:${channel.topic}`, {
            severity: "error",
            message: `Multiple channels advertise the same topic: ${channel.topic} (${existingChannel.channel.id} and ${channel.id})`,
          });
          this._emitState();
          continue;
        }
        const resolvedChannel = { channel, parsedChannel };
        this._channelsById.set(channel.id, resolvedChannel);
        this._channelsByTopic.set(channel.topic, resolvedChannel);
      }
      this._updateTopicsAndDatatypes();
      this._emitState();
      this._processUnresolvedSubscriptions();
    });

    this._client.on("unadvertise", (removedChannels) => {
      for (const id of removedChannels) {
        const chanInfo = this._channelsById.get(id);
        if (!chanInfo) {
          if (!this._unsupportedChannelIds.delete(id)) {
            this._problems.addProblem(`unadvertise:${id}`, {
              severity: "error",
              message: `Server unadvertised channel ${id} that was not advertised`,
            });
            this._emitState();
          }
          continue;
        }
        for (const [subId, { channel }] of this._resolvedSubscriptionsById) {
          if (channel.id === id) {
            this._resolvedSubscriptionsById.delete(subId);
            this._resolvedSubscriptionsByTopic.delete(channel.topic);
            this._client?.unsubscribe(subId);
            this._unresolvedSubscriptions.add(channel.topic);
          }
        }
        this._channelsById.delete(id);
        this._channelsByTopic.delete(chanInfo.channel.topic);
      }
      this._updateTopicsAndDatatypes();
      this._emitState();
    });

    this._client.on("message", ({ subscriptionId, data }) => {
      if (!this._hasReceivedMessage) {
        this._hasReceivedMessage = true;
        this._metricsCollector.recordTimeToFirstMsgs();
      }
      const chanInfo = this._resolvedSubscriptionsById.get(subscriptionId);
      if (!chanInfo) {
        const wasRecentlyCanceled = this._recentlyCanceledSubscriptions.has(subscriptionId);
        if (!wasRecentlyCanceled) {
          this._problems.addProblem(`message-missing-subscription:${subscriptionId}`, {
            severity: "warn",
            message: `Received message on unknown subscription id: ${subscriptionId}. This might be a WebSocket server bug.`,
          });
          this._emitState();
        }
        return;
      }

      try {
        this._receivedBytes += data.byteLength;
        const receiveTime = this._getCurrentTime();
        const topic = chanInfo.channel.topic;
        this._parsedMessages.push({
          topic,
          receiveTime,
          message: chanInfo.parsedChannel.deserializer(data),
          sizeInBytes: data.byteLength,
          schemaName: chanInfo.channel.schemaName,
        });

        // Update the message count for this topic
        let stats = this._topicsStats.get(topic);
        if (!stats) {
          stats = { numMessages: 0 };
          this._topicsStats.set(topic, stats);
        }
        stats.numMessages++;
      } catch (error) {
        this._problems.addProblem(`message:${chanInfo.channel.topic}`, {
          severity: "error",
          message: `Failed to parse message on ${chanInfo.channel.topic}`,
          error,
        });
      }
      this._emitState();
    });

    this._client.on("time", ({ timestamp }) => {
      if (!this._serverPublishesTime) {
        return;
      }

      const time = fromNanoSec(timestamp);
      if (this._clockTime != undefined && isLessThan(time, this._clockTime)) {
        this._numTimeSeeks++;
        this._parsedMessages = [];
      }

      this._clockTime = time;
      this._emitState();
    });

    this._client.on("parameterValues", ({ parameters, id }) => {
      const newParameters = parameters.filter((p) => !this._parameters.has(p.name));

      if (id === GET_ALL_PARAMS_REQUEST_ID) {
        // Reset params
        this._parameters = new Map(parameters.map((p) => [p.name, p.value]));
      } else {
        // Update params
        parameters.forEach((p) => this._parameters.set(p.name, p.value));
      }

      this._emitState();

      if (
        newParameters.length > 0 &&
        this._serverCapabilities.includes(ServerCapability.parametersSubscribe)
      ) {
        // Subscribe to value updates of new parameters
        this._client?.subscribeParameterUpdates(newParameters.map((p) => p.name));
      }
    });
  };

  private _updateTopicsAndDatatypes() {
    // Build a new topics array from this._channelsById
    const topics: Topic[] = Array.from(this._channelsById.values(), (chanInfo) => ({
      name: chanInfo.channel.topic,
      schemaName: chanInfo.channel.schemaName,
    }));

    // Remove stats entries for removed topics
    const topicsSet = new Set<string>(topics.map((topic) => topic.name));
    for (const topic of this._topicsStats.keys()) {
      if (!topicsSet.has(topic)) {
        this._topicsStats.delete(topic);
      }
    }

    this._topics = topics;

    if (this._datatypes) {
      // Update the _datatypes map;
      for (const { parsedChannel } of this._channelsById.values()) {
        for (const [name, types] of parsedChannel.datatypes) {
          this._datatypes.set(name, types);
        }
      }
    }
    this._emitState();
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  private _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const { _topics, _datatypes } = this;
    if (!_topics || !_datatypes) {
      return this._listener({
        name: this._name,
        presence: this._presence,
        progress: {},
        capabilities: this._playerCapabilities,
        profile: undefined,
        playerId: this._id,
        activeData: undefined,
        problems: this._problems.problems(),
      });
    }

    const currentTime = this._getCurrentTime();
    if (!this._startTime || isLessThan(currentTime, this._startTime)) {
      this._startTime = currentTime;
    }
    if (!this._endTime || isGreaterThan(currentTime, this._endTime)) {
      this._endTime = currentTime;
    }

    const messages = this._parsedMessages;
    this._parsedMessages = [];
    return this._listener({
      name: this._name,
      presence: this._presence,
      progress: {},
      capabilities: this._playerCapabilities,
      profile: undefined,
      playerId: this._id,
      problems: this._problems.problems(),
      urlState: {
        sourceId: this._sourceId,
        parameters: { url: this._url },
      },

      activeData: {
        messages,
        totalBytesReceived: this._receivedBytes,
        startTime: this._startTime,
        endTime: this._endTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        lastSeekTime: this._numTimeSeeks,
        topics: _topics,
        // Always copy topic stats since message counts and timestamps are being updated
        topicStats: new Map(this._topicsStats),
        datatypes: _datatypes,
        parameters: new Map(this._parameters),
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  public close(): void {
    this._closed = true;
    if (this._client) {
      this._client.close();
    }
    this._metricsCollector.close();
    this._hasReceivedMessage = false;
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    const newTopics = new Set(subscriptions.map(({ topic }) => topic));

    if (!this._client || this._closed) {
      // Remember requested subscriptions so we can retry subscribing when
      // the client is available.
      this._unresolvedSubscriptions = newTopics;
      return;
    }

    for (const topic of newTopics) {
      if (!this._resolvedSubscriptionsByTopic.has(topic)) {
        this._unresolvedSubscriptions.add(topic);
      }
    }

    for (const [topic, subId] of this._resolvedSubscriptionsByTopic) {
      if (!newTopics.has(topic)) {
        this._client.unsubscribe(subId);
        this._resolvedSubscriptionsByTopic.delete(topic);
        this._resolvedSubscriptionsById.delete(subId);
        this._recentlyCanceledSubscriptions.add(subId);

        // Reset the message count for this topic
        this._topicsStats.delete(topic);

        setTimeout(
          () => this._recentlyCanceledSubscriptions.delete(subId),
          SUBSCRIPTION_WARNING_SUPPRESSION_MS,
        );
      }
    }
    for (const topic of this._unresolvedSubscriptions) {
      if (!newTopics.has(topic)) {
        this._unresolvedSubscriptions.delete(topic);
      }
    }

    this._processUnresolvedSubscriptions();
  }

  private _processUnresolvedSubscriptions() {
    if (!this._client) {
      return;
    }

    for (const topic of this._unresolvedSubscriptions) {
      const chanInfo = this._channelsByTopic.get(topic);
      if (chanInfo) {
        const subId = this._client.subscribe(chanInfo.channel.id);
        this._unresolvedSubscriptions.delete(topic);
        this._resolvedSubscriptionsByTopic.set(topic, subId);
        this._resolvedSubscriptionsById.set(subId, chanInfo);
      }
    }
  }

  public setPublishers(publishers: AdvertiseOptions[]): void {
    // Since `setPublishers` is rarely called, we can get away with just unadvertising existing
    // channels und re-advertising them again
    for (const channel of this._publicationsByTopic.values()) {
      this._client?.unadvertise(channel.id);
    }
    this._publicationsByTopic.clear();
    this._unresolvedPublications = publishers;
    this._setupPublishers();
  }

  public setParameter(key: string, value: ParameterValue): void {
    if (!this._client) {
      throw new Error(`Attempted to set parameters without a valid Foxglove WebSocket connection`);
    }

    log.debug(`FoxgloveWebSocketPlayer.setParameter(key=${key}, value=${value})`);
    this._client.setParameters([{ name: key, value }], uuidv4());

    // Pre-actively update our parameter map, such that a change is detected if our update failed
    this._parameters.set(key, value);
    this._emitState();
  }

  public publish({ topic, msg }: PublishPayload): void {
    if (!this._client) {
      throw new Error(`Attempted to publish without a valid Foxglove WebSocket connection`);
    }

    const clientChannel = this._publicationsByTopic.get(topic);
    if (!clientChannel) {
      throw new Error(`Tried to publish on topic '${topic}' that has not been advertised before.`);
    }

    if (clientChannel.encoding === "json") {
      const message = Buffer.from(JSON.stringify(msg) ?? "");
      this._client.sendMessage(clientChannel.id, message);
    } else if (
      ROS_ENCODINGS.includes(clientChannel.encoding) &&
      clientChannel.messageWriter != undefined
    ) {
      const message = clientChannel.messageWriter.writeMessage(msg);
      this._client.sendMessage(clientChannel.id, message);
    }
  }

  public async callService(): Promise<unknown> {
    throw new Error("Service calls are not supported by the Foxglove WebSocket connection");
  }

  public setGlobalVariables(): void {}

  private _getCurrentTime(): Time {
    return this._serverPublishesTime ? this._clockTime ?? ZERO_TIME : fromMillis(Date.now());
  }

  private _setupPublishers(): void {
    // This function will be called again once a connection is established
    if (!this._client || this._closed) {
      return;
    }

    if (this._unresolvedPublications.length === 0) {
      return;
    }

    this._problems.removeProblems((id) => id.startsWith("pub:"));

    const encoding = this._supportedEncodings
      ? this._supportedEncodings.find((e) => SUPPORTED_PUBLICATION_ENCODINGS.includes(e))
      : FALLBACK_PUBLICATION_ENCODING;

    for (const { topic, schemaName, options } of this._unresolvedPublications) {
      const encodingProblemId = `pub:encoding:${topic}`;
      const msgdefProblemId = `pub:msgdef:${topic}`;

      if (!encoding) {
        this._problems.addProblem(encodingProblemId, {
          severity: "warn",
          message: `Cannot advertise topic '${topic}': Server does not support one of the following encodings for client-side publishing: ${SUPPORTED_PUBLICATION_ENCODINGS}`,
        });
        continue;
      }

      let messageWriter: Publication["messageWriter"] = undefined;
      if (ROS_ENCODINGS.includes(encoding)) {
        // Try to retrieve the ROS message definition for this topic
        let msgdef: RosMsgDefinition[];
        try {
          const datatypes = options?.["datatypes"] as RosDatatypes | undefined;
          if (!datatypes || !(datatypes instanceof Map)) {
            throw new Error("The datatypes option is required for publishing");
          }
          msgdef = rosDatatypesToMessageDefinition(datatypes, schemaName);
        } catch (error) {
          log.debug(error);
          this._problems.addProblem(msgdefProblemId, {
            severity: "warn",
            message: `Unknown message definition for "${topic}"`,
            tip: `Try subscribing to the topic "${topic}" before publishing to it`,
          });
          continue;
        }

        messageWriter =
          encoding === "ros1" ? new Ros1MessageWriter(msgdef) : new Ros2MessageWriter(msgdef);
      }

      const channelId = this._client.advertise(topic, encoding, schemaName);
      this._publicationsByTopic.set(topic, {
        id: channelId,
        topic,
        encoding,
        schemaName,
        messageWriter,
      });
    }

    this._unresolvedPublications = [];
    this._emitState();
  }
}

function dataTypeToFullName(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/msg/${parts[1]}`;
  }
  return dataType;
}
