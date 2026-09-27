// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  ChannelId,
  FoxgloveClient,
  ServerCapability,
  SubscriptionId,
  ServiceCallPayload,
  ServiceCallRequest,
  ServiceCallResponse,
  Parameter,
  StatusLevel,
  FetchAssetStatus,
  FetchAssetResponse,
  BinaryOpcode,
  IWebSocket,
} from "@foxglove/ws-protocol";
import * as base64 from "@protobufjs/base64";
import * as _ from "lodash-es";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@lichtblick/den/async";
import Log from "@lichtblick/log";
import { parseChannel } from "@lichtblick/mcap-support";
import { MessageDefinition, isMsgDefEqual } from "@lichtblick/message-definition";
import CommonRosTypes from "@lichtblick/rosmsg-msgs-common";
import { MessageWriter as Ros1MessageWriter } from "@lichtblick/rosmsg-serialization";
import { MessageWriter as Ros2MessageWriter } from "@lichtblick/rosmsg2-serialization";
import {
  add,
  compare,
  fromMillis,
  fromNanoSec,
  isGreaterThan,
  isLessThan,
  subtract,
  Time,
  toSec,
} from "@lichtblick/rostime";
import { ParameterValue } from "@lichtblick/suite";
import { Asset } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import {
  GetBackfillMessagesArgs,
  IteratorResult,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import PlayerAlertManager from "@lichtblick/suite-base/players/PlayerAlertManager";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import { estimateObjectSize } from "@lichtblick/suite-base/players/messageMemoryEstimation";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerAlert,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@lichtblick/suite-base/players/types";
import { HIGH_FREQUENCY_ALERT } from "@lichtblick/suite-base/players/utils/constants";
import { isTopicHighFrequency } from "@lichtblick/suite-base/players/utils/isTopicHighFrequency";
import rosDatatypesToMessageDefinition from "@lichtblick/suite-base/util/rosDatatypesToMessageDefinition";

import { JsonMessageWriter } from "./JsonMessageWriter";
import WorkerSocketAdapter from "./WorkerSocketAdapter";
import {
  CURRENT_FRAME_MAXIMUM_SIZE_BYTES,
  FALLBACK_PUBLICATION_ENCODING,
  GET_ALL_PARAMS_PERIOD_MS,
  GET_ALL_PARAMS_REQUEST_ID,
  ROS_ENCODINGS,
  SUBSCRIPTION_WARNING_SUPPRESSION_MS,
  SUPPORTED_PUBLICATION_ENCODINGS,
  SUPPORTED_SERVICE_ENCODINGS,
  ZERO_TIME,
} from "./constants";
import { dataTypeToFullName, statusLevelToAlertSeverity } from "./helpers";
import {
  MessageWriter,
  MessageDefinitionMap,
  Publication,
  ResolvedChannel,
  ResolvedService,
} from "./types";

const log = Log.getLogger(__dirname);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export default class FoxgloveWebSocketPlayer implements Player {
  readonly #sourceId: string;

  #url: string; // WebSocket URL.
  #name: string;
  #client?: FoxgloveClient; // The client when we're connected.
  #id: string = uuidv4(); // Unique ID for this player session.
  #serverCapabilities: string[] = [];
  #playerCapabilities: (typeof PLAYER_CAPABILITIES)[keyof typeof PLAYER_CAPABILITIES][] = [
    PLAYER_CAPABILITIES.playbackControl,
    PLAYER_CAPABILITIES.setSpeed,
  ];
  #supportedEncodings?: string[];
  #listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  #closed: boolean = false; // Whether the player has been completely closed using close().
  #topics?: Topic[]; // Topics as published by the WebSocket.
  #topicsStats = new Map<string, TopicStats>(); // Topic names to topic statistics.
  #datatypes: MessageDefinitionMap = new Map(); // Datatypes as published by the WebSocket.
  #parsedMessages: MessageEvent[] = []; // Queue of messages that we'll send in next _emitState() call.
  #parsedMessagesBytes: number = 0;
  #receivedBytes: number = 0;
  #metricsCollector: PlayerMetricsCollectorInterface;
  #presence: PlayerPresence = PlayerPresence.INITIALIZING;
  #alerts = new PlayerAlertManager();
  #profile?: string;
  #urlState: PlayerState["urlState"];

  /** Earliest time seen */
  #startTime?: Time;
  /** Latest time seen */
  #endTime?: Time;
  /* The most recent published time, if available */
  #clockTime?: Time;
  /* Flag indicating if the server publishes time messages */
  #serverPublishesTime = false;

  #unresolvedSubscriptions = new Set<string>();
  #resolvedSubscriptionsByTopic = new Map<string, SubscriptionId>();
  #resolvedSubscriptionsById = new Map<SubscriptionId, ResolvedChannel>();
  #channelsByTopic = new Map<string, ResolvedChannel>();
  #channelsById = new Map<ChannelId, ResolvedChannel>();
  #unsupportedChannelIds = new Set<ChannelId>();
  #recentlyCanceledSubscriptions = new Set<SubscriptionId>();
  #parameters = new Map<string, ParameterValue>();
  #getParameterInterval?: ReturnType<typeof setInterval>;
  #openTimeout?: ReturnType<typeof setInterval>;
  #connectionAttemptTimeout?: ReturnType<typeof setInterval>;
  #unresolvedPublications: AdvertiseOptions[] = [];
  #publicationsByTopic = new Map<string, Publication>();
  #serviceCallEncoding?: string;
  #servicesByName = new Map<string, ResolvedService>();
  #serviceResponseCbs = new Map<
    ServiceCallRequest["callId"],
    (response: ServiceCallResponse) => void
  >();
  #publishedTopics?: Map<string, Set<string>>;
  #subscribedTopics?: Map<string, Set<string>>;
  #advertisedServices?: Map<string, Set<string>>;
  #nextServiceCallId = 0;
  #nextAssetRequestId = 0;
  #fetchAssetRequests = new Map<number, (response: FetchAssetResponse) => void>();
  #fetchedAssets = new Map<string, Promise<Asset>>();
  #parameterTypeByName = new Map<string, Parameter["type"]>();
  #messageSizeEstimateByTopic: Record<string, number> = {};
  #ishighFrequencyMessage = false;

  // ---------------------------------------------------------------------------------------------
  // Memory mode: every received message is kept (per topic, sorted by its own log time) so the
  // connection behaves like an opened file: timeline with play / pause / seek / speed, and panels
  // using message ranges (Plot...) get the full history, including series added later.
  // ---------------------------------------------------------------------------------------------
  /** Received messages per topic, sorted by receiveTime (= message log time sent by the server). */
  #history = new Map<string, MessageEvent[]>();
  /** Topics that received new history since the Plot panels last reloaded their range. */
  #dirtyTopics = new Set<string>();
  #dirtyFlushTimer?: ReturnType<typeof setTimeout>;
  #dirtySinceMs?: number;
  /** Wall time (ms) of the last received message, to know if data is still streaming. */
  #lastDataWallMs = 0;
  /** Data range announced by the server (serverInfo dataStartTime / dataEndTime), if any. */
  #serverDataStart?: Time;
  #serverDataEnd?: Time;
  /** Earliest / latest message time received. */
  #historyStart?: Time;
  #historyEnd?: Time;
  /** Topics requested by the panels. */
  #requestedTopics = new Set<string>();
  /** Playback cursor. */
  #playbackTime?: Time;
  #isPlaying = false;
  /**
   * Live follow: the cursor stays on the latest received data (like live data). On for sources
   * without an announced end (live / streamed); off after a pause or a seek back in time, on
   * again when the cursor catches up with the end while playing.
   */
  #followLive = true;
  #speed = 1;
  #untilTime?: Time;
  #lastSeekEmitTime = 0;
  #tickTimer?: ReturnType<typeof setTimeout>;
  #lastTickMs?: number;
  /** Live range iterators waiting for new messages, per topic. */
  #liveWaiters = new Map<string, (() => void)[]>();
  #liveWakeTopics = new Set<string>();
  #liveWakeTimer?: ReturnType<typeof setTimeout>;
  /** Incremented on each new connection session, to end the previous session's iterators. */
  #session = 0;

  public constructor({
    url,
    metricsCollector,
    sourceId,
  }: {
    url: string;
    metricsCollector: PlayerMetricsCollectorInterface;
    sourceId: string;
  }) {
    this.#metricsCollector = metricsCollector;
    this.#url = url;
    this.#name = url;
    this.#metricsCollector.playerConstructed();
    this.#sourceId = sourceId;
    this.#urlState = {
      sourceId: this.#sourceId,
      parameters: { url: this.#url },
    };
    this.#open();
  }

  #open = (): void => {
    if (this.#closed) {
      return;
    }
    if (this.#client != undefined) {
      throw new Error(`Attempted to open a second Foxglove WebSocket connection`);
    }
    log.info(`Opening connection to ${this.#url}`);

    // Set a timeout to abort the connection if we are still not connected by then.
    // This will abort hanging connection attempts that can for whatever reason not
    // establish a connection with the server.
    this.#connectionAttemptTimeout = setTimeout(() => {
      this.#client?.close();
    }, 10000);

    const subprotocols = [FoxgloveClient.SUPPORTED_SUBPROTOCOL, "foxglove.sdk.v1"];

    this.#client = new FoxgloveClient({
      ws:
        typeof Worker !== "undefined"
          ? new WorkerSocketAdapter(this.#url, subprotocols)
          : (new WebSocket(this.#url, subprotocols) as IWebSocket),
    });

    this.#client.on("open", () => {
      if (this.#closed) {
        return;
      }
      if (this.#connectionAttemptTimeout != undefined) {
        clearTimeout(this.#connectionAttemptTimeout);
      }
      this.#presence = PlayerPresence.PRESENT;
      this.#resetSessionState();
      this.#alerts.clear();
      this.#channelsById.clear();
      this.#channelsByTopic.clear();
      this.#servicesByName.clear();
      this.#serviceResponseCbs.clear();
      this.#publicationsByTopic.clear();
      for (const topic of this.#resolvedSubscriptionsByTopic.keys()) {
        this.#unresolvedSubscriptions.add(topic);
      }
      this.#resolvedSubscriptionsById.clear();
      this.#resolvedSubscriptionsByTopic.clear();

      // Re-assign members that are emitted as player state
      this.#profile = undefined;
      this.#publishedTopics = undefined;
      this.#subscribedTopics = undefined;
      this.#advertisedServices = undefined;
      this.#datatypes = new Map();
      this.#parameters = new Map();
      this.#ishighFrequencyMessage = false;
    });

    this.#client.on("error", (err) => {
      log.error(err);

      if (
        (err as unknown as undefined | { message?: string })?.message != undefined &&
        err.message.includes("insecure WebSocket connection")
      ) {
        this.#alerts.addAlert("ws:connection-failed", {
          severity: "error",
          message: "Insecure WebSocket connection",
          tip: `Check that the WebSocket server at ${
            this.#url
          } is reachable and supports protocol version one of: ${subprotocols.join(", ")}.`,
        });
        this.#emitState();
      }
    });

    // Note: We've observed closed being called not only when an already open connection is closed
    // but also when a new connection fails to open
    //
    // Note: We explicitly avoid clearing state like start/end times, datatypes, etc to preserve
    // this during a disconnect event. Any necessary state clearing is handled once a new connection
    // is established
    this.#client.on("close", (event) => {
      log.info("Connection closed:", event);
      this.#presence = PlayerPresence.RECONNECTING;

      if (this.#getParameterInterval != undefined) {
        clearInterval(this.#getParameterInterval);
        this.#getParameterInterval = undefined;
      }
      if (this.#connectionAttemptTimeout != undefined) {
        clearTimeout(this.#connectionAttemptTimeout);
      }

      this.#client?.close();
      this.#client = undefined;

      this.#alerts.addAlert("ws:connection-failed", {
        severity: "error",
        message: "Connection failed",
        tip: `Check that the WebSocket server at ${
          this.#url
        } is reachable and supports protocol version one of: ${subprotocols.join(", ")}.`,
      });

      this.#emitState();
      this.#openTimeout = setTimeout(this.#open, 3000);
    });

    this.#client.on("serverInfo", (event) => {
      if (!Array.isArray(event.capabilities)) {
        this.#alerts.addAlert("ws:invalid-capabilities", {
          severity: "warn",
          message: `Server sent an invalid or missing capabilities field: '${event.capabilities}'`,
        });
      }

      const newSessionId = event.sessionId ?? uuidv4();
      if (this.#id !== newSessionId) {
        this.#resetSessionState();
      }

      this.#id = newSessionId;
      this.#name = `${this.#url}\n${event.name}`;
      this.#serverCapabilities = Array.isArray(event.capabilities) ? event.capabilities : [];
      this.#serverPublishesTime = this.#serverCapabilities.includes(ServerCapability.time);
      this.#supportedEncodings = event.supportedEncodings;
      this.#datatypes = new Map();

      // Servers with playback control announce the full data range: show it on the timeline
      // right away, before the data arrives.
      const range = event as unknown as {
        dataStartTime?: { sec: number; nsec: number };
        dataEndTime?: { sec: number; nsec: number };
      };
      this.#serverDataStart = range.dataStartTime
        ? { sec: range.dataStartTime.sec, nsec: range.dataStartTime.nsec }
        : undefined;
      this.#serverDataEnd = range.dataEndTime
        ? { sec: range.dataEndTime.sec, nsec: range.dataEndTime.nsec }
        : undefined;

      // If the server publishes the time we clear any existing clockTime we might have and let the
      // server override
      if (this.#serverPublishesTime) {
        this.#clockTime = undefined;
      }

      const maybeRosDistro = event.metadata?.["ROS_DISTRO"];
      if (maybeRosDistro) {
        const rosDistro = maybeRosDistro;
        const isRos1 = ["melodic", "noetic"].includes(rosDistro);
        this.#profile = isRos1 ? "ros1" : "ros2";

        // Add common ROS message definitions
        const rosDataTypes = isRos1
          ? CommonRosTypes.ros1
          : ["foxy", "galactic"].includes(rosDistro)
            ? CommonRosTypes.ros2galactic
            : CommonRosTypes.ros2humble;

        const dataTypes: MessageDefinitionMap = new Map();
        for (const dataType in rosDataTypes) {
          const msgDef = (rosDataTypes as Record<string, MessageDefinition>)[dataType]!;
          dataTypes.set(dataType, msgDef);
        }
        this.#updateDataTypes(dataTypes);
      }

      if (event.capabilities.includes(ServerCapability.clientPublish)) {
        this.#playerCapabilities = this.#playerCapabilities.concat(PLAYER_CAPABILITIES.advertise);
        this.#setupPublishers();
      }
      if (event.capabilities.includes(ServerCapability.services)) {
        this.#serviceCallEncoding = event.supportedEncodings?.find((e) =>
          SUPPORTED_SERVICE_ENCODINGS.includes(e),
        );

        const alertId = "callService:unsupportedEncoding";
        if (this.#serviceCallEncoding) {
          this.#playerCapabilities = this.#playerCapabilities.concat(
            PLAYER_CAPABILITIES.callServices,
          );
          this.#alerts.removeAlert(alertId);
        } else {
          this.#alerts.addAlert(alertId, {
            severity: "warn",
            message: `Calling services is disabled as no compatible encoding could be found. \
            The server supports [${event.supportedEncodings?.join(", ")}], \
            but Studio only supports [${SUPPORTED_SERVICE_ENCODINGS.join(", ")}]`,
          });
        }
      }

      if (event.capabilities.includes(ServerCapability.parameters)) {
        this.#playerCapabilities = this.#playerCapabilities.concat(
          PLAYER_CAPABILITIES.getParameters,
          PLAYER_CAPABILITIES.setParameters,
        );

        // Periodically request all available parameters.
        this.#getParameterInterval = setInterval(() => {
          this.#client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
        }, GET_ALL_PARAMS_PERIOD_MS);

        this.#client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
      }

      if (event.capabilities.includes(ServerCapability.connectionGraph)) {
        this.#client?.subscribeConnectionGraph();
      }

      if (event.capabilities.includes(ServerCapability.assets)) {
        this.#playerCapabilities = this.#playerCapabilities.concat(PLAYER_CAPABILITIES.assets);
      }

      this.#emitState();
    });

    this.#client.on("status", (event) => {
      const msg = `FoxgloveWebSocket: ${event.message}`;
      if (event.level === StatusLevel.INFO) {
        log.info(msg);
      } else if (event.level === StatusLevel.WARNING) {
        log.warn(msg);
      } else {
        log.error(msg);
      }

      const alert: PlayerAlert = {
        message: event.message,
        severity: statusLevelToAlertSeverity(event.level),
      };

      if (event.message === "Send buffer limit reached") {
        alert.tip =
          "Server is dropping messages to the client. Check if you are subscribing to large or frequent topics or adjust your server send buffer limit.";
      }

      this.#alerts.addAlert(event.message, alert);
      this.#emitState();
    });

    this.#client.on("advertise", (newChannels) => {
      for (const channel of newChannels) {
        let parsedChannel;
        try {
          let schemaEncoding;
          let schemaData;
          if (
            channel.encoding === "json" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "jsonschema")
          ) {
            schemaEncoding = "jsonschema";
            schemaData = textEncoder.encode(channel.schema);
          } else if (
            channel.encoding === "protobuf" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "protobuf")
          ) {
            schemaEncoding = "protobuf";
            schemaData = new Uint8Array(base64.length(channel.schema));
            if (base64.decode(channel.schema, schemaData, 0) !== schemaData.byteLength) {
              throw new Error(`Failed to decode base64 schema on channel ${channel.id}`);
            }
          } else if (
            channel.encoding === "flatbuffer" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "flatbuffer")
          ) {
            schemaEncoding = "flatbuffer";
            schemaData = new Uint8Array(base64.length(channel.schema));
            if (base64.decode(channel.schema, schemaData, 0) !== schemaData.byteLength) {
              throw new Error(`Failed to decode base64 schema on channel ${channel.id}`);
            }
          } else if (
            channel.encoding === "ros1" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "ros1msg")
          ) {
            schemaEncoding = "ros1msg";
            schemaData = textEncoder.encode(channel.schema);
          } else if (
            channel.encoding === "cdr" &&
            (channel.schemaEncoding == undefined ||
              ["ros2idl", "ros2msg", "omgidl"].includes(channel.schemaEncoding))
          ) {
            schemaEncoding = channel.schemaEncoding ?? "ros2msg";
            schemaData = textEncoder.encode(channel.schema);
          } else {
            const msg = channel.schemaEncoding
              ? `Unsupported combination of message / schema encoding: (${channel.encoding} / ${channel.schemaEncoding})`
              : `Unsupported message encoding ${channel.encoding}`;
            throw new Error(msg);
          }
          parsedChannel = parseChannel({
            messageEncoding: channel.encoding,
            schema: { name: channel.schemaName, encoding: schemaEncoding, data: schemaData },
          });
        } catch (error) {
          this.#unsupportedChannelIds.add(channel.id);
          this.#alerts.addAlert(`schema:${channel.topic}`, {
            severity: "error",
            message: `Failed to parse channel schema on ${channel.topic}`,
            error,
          });
          this.#emitState();
          continue;
        }
        const existingChannel = this.#channelsByTopic.get(channel.topic);
        if (existingChannel && !_.isEqual(channel, existingChannel.channel)) {
          this.#alerts.addAlert(`duplicate-topic:${channel.topic}`, {
            severity: "error",
            message: `Multiple channels advertise the same topic: ${channel.topic} (${existingChannel.channel.id} and ${channel.id})`,
          });
          this.#emitState();
          continue;
        }
        const resolvedChannel = { channel, parsedChannel };
        this.#channelsById.set(channel.id, resolvedChannel);
        this.#channelsByTopic.set(channel.topic, resolvedChannel);
      }
      this.#updateTopicsAndDatatypes();
      this.#emitState();
      this.#processUnresolvedSubscriptions();
    });

    this.#client.on("unadvertise", (removedChannels) => {
      for (const id of removedChannels) {
        const chanInfo = this.#channelsById.get(id);
        if (!chanInfo) {
          if (!this.#unsupportedChannelIds.delete(id)) {
            this.#alerts.addAlert(`unadvertise:${id}`, {
              severity: "error",
              message: `Server unadvertised channel ${id} that was not advertised`,
            });
            this.#emitState();
          }
          continue;
        }
        for (const [subId, { channel }] of this.#resolvedSubscriptionsById) {
          if (channel.id === id) {
            this.#resolvedSubscriptionsById.delete(subId);
            this.#resolvedSubscriptionsByTopic.delete(channel.topic);
            this.#client?.unsubscribe(subId);
            this.#unresolvedSubscriptions.add(channel.topic);
          }
        }
        this.#channelsById.delete(id);
        this.#channelsByTopic.delete(chanInfo.channel.topic);
      }
      this.#updateTopicsAndDatatypes();
      this.#emitState();
    });

    this.#client.on("message", ({ subscriptionId, timestamp, data }) => {
      const chanInfo = this.#resolvedSubscriptionsById.get(subscriptionId);
      if (!chanInfo) {
        const wasRecentlyCanceled = this.#recentlyCanceledSubscriptions.has(subscriptionId);
        if (!wasRecentlyCanceled) {
          this.#alerts.addAlert(`message-missing-subscription:${subscriptionId}`, {
            severity: "warn",
            message: `Received message on unknown subscription id: ${subscriptionId}. This might be a WebSocket server bug.`,
          });
          this.#emitState();
        }
        return;
      }

      try {
        this.#receivedBytes += data.byteLength;
        // Memory mode: a message is placed at its own log time (sent by the server), not at the
        // time it arrives.
        const receiveTime = fromNanoSec(timestamp);
        const topic = chanInfo.channel.topic;
        const deserializedMessage = chanInfo.parsedChannel.deserialize(data);

        // Lookup the size estimate for this topic or compute it if not found in the cache.
        let msgSizeEstimate = this.#messageSizeEstimateByTopic[topic];
        if (msgSizeEstimate == undefined) {
          msgSizeEstimate = estimateObjectSize(deserializedMessage);
          this.#messageSizeEstimateByTopic[topic] = msgSizeEstimate;
        }

        const sizeInBytes = Math.max(data.byteLength, msgSizeEstimate);
        const msgEvent: MessageEvent = {
          topic,
          receiveTime,
          message: deserializedMessage,
          sizeInBytes,
          schemaName: chanInfo.channel.schemaName,
        };
        if (!this.#addToHistory(msgEvent)) {
          // Already known (the server re-sent it): nothing new.
          return;
        }
        // If the cursor is already past this message and it is now the latest one of its topic,
        // hand it to the panels so they show the current value.
        const cursor = this.#playbackTime;
        if (cursor && compare(receiveTime, cursor) <= 0) {
          const latest = this.#latestAt(topic, cursor);
          if (latest === msgEvent) {
            this.#parsedMessages.push(msgEvent);
          }
        }
        this.#parsedMessagesBytes += sizeInBytes;
        if (this.#parsedMessagesBytes > CURRENT_FRAME_MAXIMUM_SIZE_BYTES) {
          this.#alerts.addAlert(`webSocketPlayer:parsedMessageCacheFull`, {
            severity: "error",
            message: `WebSocketPlayer maximum frame size (${(
              CURRENT_FRAME_MAXIMUM_SIZE_BYTES / 1_000_000
            ).toFixed(
              2,
            )}MB) reached. Dropping old messages. This accumulation can occur if the browser tab has been inactive.`,
          });
          // Amortize cost of dropping messages by dropping parsedMessages size to
          // 80% so that it doesn't happen for every message after reaching the limit
          const evictUntilSize = 0.8 * CURRENT_FRAME_MAXIMUM_SIZE_BYTES;
          let droppedBytes = 0;
          let indexToCutBefore = 0;
          while (this.#parsedMessagesBytes - droppedBytes > evictUntilSize) {
            droppedBytes += this.#parsedMessages[indexToCutBefore]!.sizeInBytes;
            indexToCutBefore++;
          }
          this.#parsedMessages.splice(0, indexToCutBefore);
          this.#parsedMessagesBytes -= droppedBytes;
        }

        // Update the message count for this topic
        const topicStats = new Map(this.#topicsStats);
        let stats = topicStats.get(topic);
        if (!stats) {
          stats = { numMessages: 0 };
          topicStats.set(topic, stats);
        }
        stats.numMessages++;
        this.#topicsStats = topicStats;

        if (!this.#ishighFrequencyMessage) {
          const duration =
            this.#startTime && this.#endTime ? subtract(this.#endTime, this.#startTime) : undefined;
          this.#ishighFrequencyMessage = isTopicHighFrequency({
            topicStats: this.#topicsStats,
            topic: { name: topic, schemaName: chanInfo.channel.schemaName },
            duration,
          });
          if (this.#ishighFrequencyMessage) {
            this.#alerts.addAlert(HIGH_FREQUENCY_ALERT.id, {
              severity: HIGH_FREQUENCY_ALERT.severity,
              message: HIGH_FREQUENCY_ALERT.message,
              error: new Error(HIGH_FREQUENCY_ALERT.errorMessage),
            });
          }
        }
      } catch (error) {
        this.#alerts.addAlert(`message:${chanInfo.channel.topic}`, {
          severity: "error",
          message: `Failed to parse message on ${chanInfo.channel.topic}`,
          error,
        });
      }
      this.#emitState();
    });

    // Memory mode: the playback cursor is controlled locally (like for a file) and every message
    // carries its own time, so server time messages are not used.
    this.#client.on("time", () => {});

    this.#client.on("parameterValues", ({ parameters, id }) => {
      const mappedParameters = parameters.map((param) => {
        return param.type === "byte_array"
          ? {
              ...param,
              value: Uint8Array.from(atob(param.value as string), (c) => c.charCodeAt(0)),
            }
          : param;
      });
      const parameterTypes = parameters.map((p) => [p.name, p.type] as [string, Parameter["type"]]);
      const parameterTypesMap = new Map<string, Parameter["type"]>(parameterTypes);

      const newParameters = mappedParameters.filter((param) => !this.#parameters.has(param.name));

      if (id === GET_ALL_PARAMS_REQUEST_ID) {
        // Reset params
        this.#parameters = new Map(mappedParameters.map((param) => [param.name, param.value]));
        this.#parameterTypeByName = parameterTypesMap;
      } else {
        // Update params
        const updatedParameters = new Map(this.#parameters);
        mappedParameters.forEach((param) => updatedParameters.set(param.name, param.value));
        this.#parameters = updatedParameters;
        for (const [paramName, paramType] of parameterTypesMap) {
          this.#parameterTypeByName.set(paramName, paramType);
        }
      }

      this.#emitState();

      if (
        newParameters.length > 0 &&
        this.#serverCapabilities.includes(ServerCapability.parametersSubscribe)
      ) {
        // Subscribe to value updates of new parameters
        this.#client?.subscribeParameterUpdates(newParameters.map((p) => p.name));
      }
    });

    this.#client.on("advertiseServices", (services) => {
      if (!this.#serviceCallEncoding) {
        return;
      }

      let defaultSchemaEncoding = "";
      if (this.#serviceCallEncoding === "json") {
        defaultSchemaEncoding = "jsonschema";
      } else if (this.#serviceCallEncoding === "ros1") {
        defaultSchemaEncoding = "ros1msg";
      } else if (this.#serviceCallEncoding === "cdr") {
        defaultSchemaEncoding = "ros2msg";
      }

      for (const service of services) {
        const serviceAlertId = `service:${service.id}`;
        // If not explicitly given, derive request / response type name from the service type
        // (according to ROS convention).
        const requestType = service.request?.schemaName ?? `${service.type}_Request`;
        const responseType = service.response?.schemaName ?? `${service.type}_Response`;
        const requestMsgEncoding = service.request?.encoding ?? this.#serviceCallEncoding;
        const responseMsgEncoding = service.response?.encoding ?? this.#serviceCallEncoding;

        // Note: The `requestSchema` and `responseSchema` fields are deprecated in @foxglove/ws-protocol.
        // However, they are still required for compatibility with Foxglove Bridge.
        // We are temporarily reintroducing support for these fields to avoid blocking users.
        // This usage should be removed once Foxglove Bridge transitions away from these deprecated fields.
        try {
          if (
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            (service.request == undefined && service.requestSchema == undefined) ||
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            (service.response == undefined && service.responseSchema == undefined)
          ) {
            throw new Error("Invalid service definition, at least one required field is missing");
          } else if (
            !defaultSchemaEncoding &&
            (service.request == undefined || service.response == undefined)
          ) {
            throw new Error("Cannot determine service request or response schema encoding");
          } else if (!SUPPORTED_SERVICE_ENCODINGS.includes(requestMsgEncoding)) {
            const supportedEncodingsStr = SUPPORTED_SERVICE_ENCODINGS.join(", ");
            throw new Error(
              `Unsupported service request message encoding. ${requestMsgEncoding} not in list of supported encodings [${supportedEncodingsStr}]`,
            );
          }

          const parseChannelOptions = { allowEmptySchema: true };
          const parsedRequest = parseChannel(
            {
              messageEncoding: requestMsgEncoding,
              schema: {
                name: requestType,
                encoding: service.request?.schemaEncoding ?? defaultSchemaEncoding,
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                data: textEncoder.encode(service.request?.schema ?? service.requestSchema),
              },
            },
            parseChannelOptions,
          );
          const parsedResponse = parseChannel(
            {
              messageEncoding: responseMsgEncoding,
              schema: {
                name: responseType,
                encoding: service.response?.schemaEncoding ?? defaultSchemaEncoding,
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                data: textEncoder.encode(service.response?.schema ?? service.responseSchema),
              },
            },
            parseChannelOptions,
          );
          const requestMsgDef = rosDatatypesToMessageDefinition(
            parsedRequest.datatypes,
            requestType,
          );
          let requestMessageWriter: MessageWriter | undefined;
          if (requestMsgEncoding === "ros1") {
            requestMessageWriter = new Ros1MessageWriter(requestMsgDef);
          } else if (requestMsgEncoding === "cdr") {
            requestMessageWriter = new Ros2MessageWriter(requestMsgDef);
          } else if (requestMsgEncoding === "json") {
            requestMessageWriter = new JsonMessageWriter();
          }
          if (!requestMessageWriter) {
            // Should never go here as we sanity-checked the encoding already above
            throw new Error(`Unsupported service request message encoding ${requestMsgEncoding}`);
          }

          // Add type definitions for service response and request
          this.#updateDataTypes(parsedRequest.datatypes);
          this.#updateDataTypes(parsedResponse.datatypes);

          const resolvedService: ResolvedService = {
            service,
            parsedResponse,
            requestMessageWriter,
          };
          this.#servicesByName.set(service.name, resolvedService);
          this.#alerts.removeAlert(serviceAlertId);

          // Issue a warning to users if the service relies on deprecated fields (`requestSchema` or `responseSchema`).
          // This highlights the need for migration, as these fields will be removed in future versions.

          // eslint-disable-next-line @typescript-eslint/no-deprecated
          if (service.requestSchema || service.responseSchema) {
            this.#alerts.addAlert(serviceAlertId, {
              severity: "warn",
              message: `Service ${service.name}`,
              error: new Error(
                "requestSchema and responseSchema are deprecated and will not be supported in future versions of Lichtblick",
              ),
            });
          }
        } catch (error) {
          this.#alerts.addAlert(serviceAlertId, {
            severity: "error",
            message: `Failed to parse service ${service.name}`,
            error,
          });
        }
      }
      this.#emitState();
    });

    this.#client.on("unadvertiseServices", (serviceIds) => {
      let needsStateUpdate = false;
      for (const serviceId of serviceIds) {
        const service: ResolvedService | undefined = Object.values(this.#servicesByName).find(
          (srv) => srv.service.id === serviceId,
        );
        if (service) {
          this.#servicesByName.delete(service.service.name);
        }
        const serviceAlertId = `service:${serviceId}`;
        needsStateUpdate = this.#alerts.removeAlert(serviceAlertId) || needsStateUpdate;
      }
      if (needsStateUpdate) {
        this.#emitState();
      }
    });

    this.#client.on("serviceCallResponse", (response) => {
      const responseCallback = this.#serviceResponseCbs.get(response.callId);
      if (!responseCallback) {
        this.#alerts.addAlert(`callService:${response.callId}`, {
          severity: "error",
          message: `Received a response for a service for which no callback was registered`,
        });
        return;
      }
      responseCallback(response);
      this.#serviceResponseCbs.delete(response.callId);
    });

    this.#client.on("connectionGraphUpdate", (event) => {
      if (event.publishedTopics.length > 0 || event.removedTopics.length > 0) {
        const newMap = new Map<string, Set<string>>(this.#publishedTopics ?? new Map());
        for (const { name, publisherIds } of event.publishedTopics) {
          newMap.set(name, new Set(publisherIds));
        }
        event.removedTopics.forEach((topic) => newMap.delete(topic));
        this.#publishedTopics = newMap;
      }
      if (event.subscribedTopics.length > 0 || event.removedTopics.length > 0) {
        const newMap = new Map<string, Set<string>>(this.#subscribedTopics ?? new Map());
        for (const { name, subscriberIds } of event.subscribedTopics) {
          newMap.set(name, new Set(subscriberIds));
        }
        event.removedTopics.forEach((topic) => newMap.delete(topic));
        this.#subscribedTopics = newMap;
      }
      if (event.advertisedServices.length > 0 || event.removedServices.length > 0) {
        const newMap = new Map<string, Set<string>>(this.#advertisedServices ?? new Map());
        for (const { name, providerIds } of event.advertisedServices) {
          newMap.set(name, new Set(providerIds));
        }
        event.removedServices.forEach((service) => newMap.delete(service));
        this.#advertisedServices = newMap;
      }

      this.#emitState();
    });

    this.#client.on("fetchAssetResponse", (response) => {
      const responseCallback = this.#fetchAssetRequests.get(response.requestId);
      if (!responseCallback) {
        throw Error(
          `Received a response for a fetch asset request for which no callback was registered`,
        );
      }
      responseCallback(response);
      this.#serviceResponseCbs.delete(response.requestId);
    });
  };

  #updateTopicsAndDatatypes() {
    // Build a new topics array from this._channelsById
    const topics: Topic[] = Array.from(this.#channelsById.values(), (chanInfo) => ({
      name: chanInfo.channel.topic,
      schemaName: chanInfo.channel.schemaName,
    }));

    // Remove stats entries for removed topics
    const topicsSet = new Set<string>(topics.map((topic) => topic.name));
    const topicStats = new Map(this.#topicsStats);
    for (const topic of topicStats.keys()) {
      if (!topicsSet.has(topic)) {
        topicStats.delete(topic);
      }
    }

    this.#topicsStats = topicStats;
    this.#topics = topics;

    // Update the _datatypes map;
    for (const { parsedChannel } of this.#channelsById.values()) {
      this.#updateDataTypes(parsedChannel.datatypes);
    }

    this.#emitState();
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  #emitState = debouncePromise(() => {
    if (!this.#listener || this.#closed) {
      return Promise.resolve();
    }

    if (!this.#topics) {
      return this.#listener({
        name: this.#name,
        presence: this.#presence,
        progress: {},
        capabilities: this.#playerCapabilities,
        profile: undefined,
        playerId: this.#id,
        activeData: undefined,
        alerts: this.#alerts.alerts(),
        urlState: this.#urlState,
      });
    }

    const range = this.#dataRange();
    if (range) {
      this.#startTime = range.start;
      this.#endTime = range.end;
    } else {
      // No data yet: an empty range at "now" so the app can render.
      const now = this.#getCurrentTime();
      this.#startTime ??= now;
      this.#endTime ??= now;
    }
    const currentTime = this.#playbackTime ?? this.#startTime;

    const messages = this.#parsedMessages;
    this.#parsedMessages = [];
    this.#parsedMessagesBytes = 0;
    return this.#listener({
      name: this.#name,
      presence: this.#presence,
      progress: { fullyLoadedFractionRanges: this.#loadedRanges() },
      capabilities: this.#playerCapabilities,
      profile: this.#profile,
      playerId: this.#id,
      alerts: this.#alerts.alerts(),
      urlState: this.#urlState,

      activeData: {
        messages,
        totalBytesReceived: this.#receivedBytes,
        startTime: this.#startTime,
        endTime: this.#endTime,
        currentTime,
        isPlaying: this.#isPlaying,
        speed: this.#speed,
        lastSeekTime: this.#lastSeekEmitTime,
        topics: this.#topics,
        topicStats: this.#topicsStats,
        datatypes: this.#datatypes,
        parameters: this.#parameters,
        publishedTopics: this.#publishedTopics,
        subscribedTopics: this.#subscribedTopics,
        services: this.#advertisedServices,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    this.#emitState();
  }

  public close(): void {
    this.#closed = true;
    this.#stopTicking();
    if (this.#liveWakeTimer != undefined) {
      clearTimeout(this.#liveWakeTimer);
      this.#liveWakeTimer = undefined;
    }
    this.#wakeLiveIterators();
    if (this.#dirtyFlushTimer != undefined) {
      clearTimeout(this.#dirtyFlushTimer);
      this.#dirtyFlushTimer = undefined;
    }
    this.#client?.close();
    if (this.#openTimeout != undefined) {
      clearTimeout(this.#openTimeout);
      this.#openTimeout = undefined;
    }
    if (this.#getParameterInterval != undefined) {
      clearInterval(this.#getParameterInterval);
      this.#getParameterInterval = undefined;
    }
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    const newTopics = new Set(subscriptions.map(({ topic }) => topic));
    this.#requestedTopics = newTopics;

    if (!this.#client || this.#closed) {
      // Remember requested subscriptions so we can retry subscribing when
      // the client is available.
      this.#unresolvedSubscriptions = newTopics;
      return;
    }

    for (const topic of newTopics) {
      if (!this.#resolvedSubscriptionsByTopic.has(topic)) {
        this.#unresolvedSubscriptions.add(topic);
      }
    }

    const topicStats = new Map(this.#topicsStats);
    for (const [topic, subId] of this.#resolvedSubscriptionsByTopic) {
      if (!newTopics.has(topic)) {
        this.#client.unsubscribe(subId);
        this.#resolvedSubscriptionsByTopic.delete(topic);
        this.#resolvedSubscriptionsById.delete(subId);
        this.#recentlyCanceledSubscriptions.add(subId);

        // Reset the message count for this topic
        topicStats.delete(topic);

        setTimeout(
          () => this.#recentlyCanceledSubscriptions.delete(subId),
          SUBSCRIPTION_WARNING_SUPPRESSION_MS,
        );
      }
    }
    this.#topicsStats = topicStats;

    for (const topic of this.#unresolvedSubscriptions) {
      if (!newTopics.has(topic)) {
        this.#unresolvedSubscriptions.delete(topic);
      }
    }

    this.#processUnresolvedSubscriptions();
  }

  #processUnresolvedSubscriptions() {
    if (!this.#client) {
      return;
    }

    for (const topic of this.#unresolvedSubscriptions) {
      const chanInfo = this.#channelsByTopic.get(topic);
      if (chanInfo) {
        const subId = this.#client.subscribe(chanInfo.channel.id);
        this.#unresolvedSubscriptions.delete(topic);
        this.#resolvedSubscriptionsByTopic.set(topic, subId);
        this.#resolvedSubscriptionsById.set(subId, chanInfo);
      }
    }
  }

  public setPublishers(publishers: AdvertiseOptions[]): void {
    // Filter out duplicates.
    const uniquePublications = _.uniqWith(publishers, _.isEqual);

    // Save publications and return early if we are not connected or the advertise capability is missing.
    if (
      !this.#client ||
      this.#closed ||
      !this.#playerCapabilities.includes(PLAYER_CAPABILITIES.advertise)
    ) {
      this.#unresolvedPublications = uniquePublications;
      return;
    }

    // Determine new & removed publications.
    const currentPublications = Array.from(this.#publicationsByTopic.values());
    const removedPublications = currentPublications.filter((channel) => {
      return (
        uniquePublications.find(
          ({ topic, schemaName }) => channel.topic === topic && channel.schemaName === schemaName,
        ) == undefined
      );
    });
    const newPublications = uniquePublications.filter(({ topic, schemaName }) => {
      return (
        currentPublications.find(
          (publication) => publication.topic === topic && publication.schemaName === schemaName,
        ) == undefined
      );
    });

    // Unadvertise removed channels.
    for (const channel of removedPublications) {
      this.#unadvertiseChannel(channel);
    }

    // Advertise new channels.
    for (const publication of newPublications) {
      this.#advertiseChannel(publication);
    }

    if (removedPublications.length > 0 || newPublications.length > 0) {
      this.#emitState();
    }
  }

  public setParameter(key: string, value: ParameterValue): void {
    if (!this.#client) {
      throw new Error(`Attempted to set parameters without a valid Foxglove WebSocket connection`);
    }

    log.debug(`FoxgloveWebSocketPlayer.setParameter(key=${key}, value=${JSON.stringify(value)})`);
    const isByteArray = value instanceof Uint8Array;
    const paramValueToSent = isByteArray ? btoa(textDecoder.decode(value)) : value;
    this.#client.setParameters(
      [
        {
          name: key,
          value: paramValueToSent as Parameter["value"],
          type: isByteArray ? "byte_array" : this.#parameterTypeByName.get(key),
        },
      ],
      uuidv4(),
    );

    // Pre-actively update our parameter map, such that a change is detected if our update failed
    this.#parameters.set(key, value);
    this.#emitState();
  }

  public publish({ topic, msg }: PublishPayload): void {
    if (!this.#client) {
      throw new Error(`Attempted to publish without a valid Foxglove WebSocket connection`);
    }

    const clientChannel = this.#publicationsByTopic.get(topic);
    if (!clientChannel) {
      throw new Error(`Tried to publish on topic '${topic}' that has not been advertised before.`);
    }

    if (clientChannel.encoding === "json") {
      // Ensure that typed arrays are encoded as arrays and not objects.
      const replacer = (_key: string, value: unknown) => {
        return ArrayBuffer.isView(value)
          ? Array.from(value as unknown as ArrayLike<unknown>)
          : value;
      };
      const message = Buffer.from(JSON.stringify(msg, replacer) ?? "");
      this.#client.sendMessage(clientChannel.id, new Uint8Array(message));
    } else if (
      ROS_ENCODINGS.includes(clientChannel.encoding) &&
      clientChannel.messageWriter != undefined
    ) {
      const message = clientChannel.messageWriter.writeMessage(msg);
      this.#client.sendMessage(clientChannel.id, message);
    }
  }

  public async callService(serviceName: string, request: unknown): Promise<unknown> {
    if (!this.#client) {
      throw new Error(
        `Attempted to call service ${serviceName} without a valid Foxglove WebSocket connection.`,
      );
    }

    if (request == undefined || typeof request !== "object") {
      throw new Error("FoxgloveWebSocketPlayer#callService request must be an object.");
    }

    const resolvedService = this.#servicesByName.get(serviceName);
    if (!resolvedService) {
      throw new Error(
        `Tried to call service '${serviceName}' that has not been advertised before.`,
      );
    }

    const { service, parsedResponse, requestMessageWriter } = resolvedService;

    const requestMsgEncoding = service.request?.encoding ?? this.#serviceCallEncoding!;
    const serviceCallRequest: ServiceCallPayload = {
      serviceId: service.id,
      callId: ++this.#nextServiceCallId,
      encoding: requestMsgEncoding,
      data: new DataView(new Uint8Array().buffer),
    };

    const message = requestMessageWriter.writeMessage(request);
    serviceCallRequest.data = new DataView(message.buffer);
    this.#client.sendServiceCallRequest(serviceCallRequest);

    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      this.#serviceResponseCbs.set(serviceCallRequest.callId, (response: ServiceCallResponse) => {
        try {
          const data = parsedResponse.deserialize(response.data);
          resolve(data as Record<string, unknown>);
        } catch (error: unknown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  }

  public async fetchAsset(uri: string): Promise<Asset> {
    if (!this.#client) {
      throw new Error(
        `Attempted to fetch assset ${uri} without a valid Foxglove WebSocket connection.`,
      );
    } else if (!this.#serverCapabilities.includes(ServerCapability.assets)) {
      throw new Error(`Fetching assets (${uri}) is not supported for FoxgloveWebSocketPlayer`);
    }

    let promise = this.#fetchedAssets.get(uri);
    if (promise) {
      return await promise;
    }

    promise = new Promise<Asset>((resolve, reject) => {
      const fetchedAsset = this.#fetchedAssets.get(uri);
      if (fetchedAsset) {
        resolve(fetchedAsset);
        return;
      }

      const assetRequestId = ++this.#nextAssetRequestId;
      this.#fetchAssetRequests.set(assetRequestId, (response) => {
        if (response.status === FetchAssetStatus.SUCCESS) {
          const newAsset: Asset = {
            uri,
            data: new Uint8Array(
              response.data.buffer,
              response.data.byteOffset,
              response.data.byteLength,
            ),
          };
          resolve(newAsset);
        } else {
          reject(new Error(`Failed to fetch asset: ${response.error}`));
        }
      });
      this.#client?.fetchAsset(uri, assetRequestId);
    });

    this.#fetchedAssets.set(uri, promise);
    return await promise;
  }

  public setGlobalVariables(): void {}

  // ---------------------------------------------------------------------------------------------
  // Memory mode: message ranges, backfill and playback, served from the received history
  // ---------------------------------------------------------------------------------------------

  /**
   * Iterate over the received history of a topic (used by the Plot panel & co to get the full
   * dataset).
   *
   * Live source, whole topic requested (message range subscriptions): the iterator yields the
   * history, then keeps yielding new messages as they arrive, so the panels stay in sync with the
   * timeline end. Otherwise the iterator is a snapshot: when new data arrives for the topic, the
   * topic object is replaced (see #flushDirtyTopics) and the panels request a fresh iterator.
   */
  public getBatchIterator(
    topic: string,
    options?: { start?: Time; end?: Time },
  ): AsyncIterableIterator<Readonly<IteratorResult>> | undefined {
    if (options == undefined && this.#isLiveSource()) {
      return this.#liveIterator(topic);
    }
    const events = this.#history.get(topic) ?? [];
    const first = options?.start ? upperBound(events, options.start, { inclusive: true }) : 0;
    const last = options?.end
      ? upperBound(events, options.end, { inclusive: false })
      : events.length;
    const snapshot = events.slice(first, last);
    return (async function* () {
      for (const msgEvent of snapshot) {
        yield { type: "message-event", msgEvent } as const;
      }
    })();
  }

  #liveIterator(topic: string): AsyncIterableIterator<Readonly<IteratorResult>> {
    const session = this.#session;
    const isStale = () => this.#closed || this.#session !== session;
    const getEvents = () => this.#history.get(topic) ?? [];
    const waitForData = async () => {
      await new Promise<void>((resolve) => {
        const waiters = this.#liveWaiters.get(topic) ?? [];
        waiters.push(resolve);
        this.#liveWaiters.set(topic, waiters);
      });
    };
    return (async function* () {
      let next = 0;
      for (;;) {
        const events = getEvents();
        while (next < events.length) {
          yield { type: "message-event", msgEvent: events[next++]! } as const;
        }
        if (isStale()) {
          return;
        }
        const last = events[events.length - 1];
        if (last) {
          // Everything received so far was yielded: lets the consumer flush its pending batch.
          yield { type: "stamp", stamp: last.receiveTime } as const;
        }
        await waitForData();
      }
    })();
  }

  /** Wake the live iterators of `topic` soon (at most once per frame, so panels get batches). */
  #scheduleLiveWake(topic: string): void {
    this.#liveWakeTopics.add(topic);
    this.#liveWakeTimer ??= setTimeout(() => {
      this.#liveWakeTimer = undefined;
      const topics = this.#liveWakeTopics;
      this.#liveWakeTopics = new Set();
      for (const name of topics) {
        this.#wakeLiveIterators(name);
      }
    }, TICK_INTERVAL_MS);
  }

  /** Wake the live iterators of `topic` (all topics if undefined). */
  #wakeLiveIterators(topic?: string): void {
    const topics = topic != undefined ? [topic] : [...this.#liveWaiters.keys()];
    for (const name of topics) {
      const waiters = this.#liveWaiters.get(name);
      if (waiters) {
        this.#liveWaiters.delete(name);
        for (const resolve of waiters) {
          resolve();
        }
      }
    }
  }

  /** Latest message at or before `time` for each requested topic. */
  public async getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    return this.#backfill(args.topics.keys(), args.time);
  }

  public startPlayback(): void {
    this.#startPlay();
  }

  public playUntil(time: Time): void {
    this.#startPlay(time);
  }

  public pausePlayback(): void {
    if (!this.#isPlaying) {
      return;
    }
    this.#isPlaying = false;
    this.#followLive = false;
    this.#untilTime = undefined;
    this.#stopTicking();
    this.#emitState();
  }

  public setPlaybackSpeed(speed: number): void {
    this.#speed = speed;
    this.#lastTickMs = undefined;
    this.#emitState();
  }

  public seekPlayback(time: Time): void {
    const range = this.#dataRange();
    if (!range) {
      return;
    }
    const target = clampTime(time, range.start, range.end);
    // Seeking to the end while playing keeps following the live data; anywhere else stops it.
    this.#followLive = this.#isPlaying && compare(target, range.end) >= 0 && this.#isLiveSource();
    this.#playbackTime = target;
    this.#lastTickMs = undefined;
    // Like a file: panels get the last message of each topic at the new time.
    this.#parsedMessages = this.#backfill(this.#requestedTopics, target);
    this.#parsedMessagesBytes = 0;
    this.#lastSeekEmitTime = Date.now();
    this.#emitState();
  }

  #startPlay(untilTime?: Time): void {
    const range = this.#dataRange();
    if (this.#isPlaying || !range) {
      return;
    }
    const atEnd = !this.#playbackTime || compare(this.#playbackTime, range.end) >= 0;
    if (atEnd && this.#isLiveSource() && this.#isStreaming()) {
      // At the end of data still arriving: follow it.
      this.#followLive = true;
    } else if (atEnd) {
      // At the end: restart from the beginning (like a file).
      this.seekPlayback(range.start);
    }
    if (untilTime && this.#playbackTime && compare(untilTime, this.#playbackTime) <= 0) {
      return;
    }
    this.#untilTime = untilTime ? clampTime(untilTime, range.start, range.end) : undefined;
    this.#isPlaying = true;
    this.#lastTickMs = undefined;
    this.#scheduleTick();
    this.#emitState();
  }

  #scheduleTick(): void {
    if (this.#tickTimer == undefined && this.#isPlaying && !this.#closed) {
      this.#tickTimer = setTimeout(this.#tick, TICK_INTERVAL_MS);
    }
  }

  #stopTicking(): void {
    if (this.#tickTimer != undefined) {
      clearTimeout(this.#tickTimer);
      this.#tickTimer = undefined;
    }
    this.#lastTickMs = undefined;
  }

  /** Advance the cursor by the elapsed wall time x speed and emit the messages in between. */
  #tick = (): void => {
    this.#tickTimer = undefined;
    const range = this.#dataRange();
    if (!this.#isPlaying || !range || !this.#playbackTime) {
      return;
    }
    const nowMs = performance.now();
    const elapsedMs = this.#lastTickMs != undefined ? nowMs - this.#lastTickMs : TICK_INTERVAL_MS;
    this.#lastTickMs = nowMs;
    // Cap a single step so a slow frame does not jump too far.
    const stepMs = Math.min(elapsedMs, MAX_TICK_WALL_MS) * this.#speed;

    if (this.#followLive) {
      // Live follow: jump to the latest data, whatever the speed. Keeps playing even when no data
      // arrives for a while (e.g. the server is stopped on a breakpoint).
      if (compare(range.end, this.#playbackTime) > 0) {
        this.#parsedMessages.push(
          ...this.#collect(this.#requestedTopics, this.#playbackTime, range.end),
        );
        this.#playbackTime = range.end;
        this.#emitState();
      }
      this.#scheduleTick();
      return;
    }

    const stop = this.#untilTime ?? range.end;
    let target = add(this.#playbackTime, fromMillis(stepMs));
    const reachedStop = compare(target, stop) >= 0;
    if (reachedStop) {
      target = stop;
    }

    this.#parsedMessages.push(...this.#collect(this.#requestedTopics, this.#playbackTime, target));
    this.#playbackTime = target;

    if (reachedStop) {
      if (this.#untilTime == undefined && this.#isLiveSource() && this.#isStreaming()) {
        // Caught up with data still arriving: follow it (live).
        this.#followLive = true;
      } else if (this.#untilTime != undefined || !this.#isStreaming()) {
        // Otherwise stop, like a file.
        this.#isPlaying = false;
        this.#untilTime = undefined;
      }
    }
    this.#emitState();
    this.#scheduleTick();
  };

  /** Insert a message in the topic history. Returns false if it was already there. */
  #addToHistory(msgEvent: MessageEvent): boolean {
    let events = this.#history.get(msgEvent.topic);
    if (!events) {
      events = [];
      this.#history.set(msgEvent.topic, events);
    }
    const index = upperBound(events, msgEvent.receiveTime, { inclusive: false });
    // Same topic, same time: the server re-sent a message we already have.
    const previous = events[index - 1];
    if (previous && compare(previous.receiveTime, msgEvent.receiveTime) === 0) {
      return false;
    }
    events.splice(index, 0, msgEvent);

    if (!this.#historyStart || isLessThan(msgEvent.receiveTime, this.#historyStart)) {
      this.#historyStart = msgEvent.receiveTime;
    }
    if (!this.#historyEnd || isGreaterThan(msgEvent.receiveTime, this.#historyEnd)) {
      this.#historyEnd = msgEvent.receiveTime;
    }
    this.#lastDataWallMs = Date.now();
    this.#playbackTime ??= this.#serverDataStart ?? msgEvent.receiveTime;
    if (this.#isLiveSource() && index === events.length - 1) {
      // Appended at the end: the live iterators pick it up.
      this.#scheduleLiveWake(msgEvent.topic);
    } else {
      // Inserted in the past: panels reload the topic.
      this.#markTopicDirty(msgEvent.topic);
    }
    if (this.#followLive && this.#isLiveSource() && !this.#isPlaying) {
      // Live source: play and keep the cursor on the latest data.
      this.#isPlaying = true;
      this.#untilTime = undefined;
      this.#lastTickMs = undefined;
      this.#scheduleTick();
    }
    return true;
  }

  /** No data end announced by the server: live data or a stream whose end is not known. */
  #isLiveSource(): boolean {
    return this.#serverDataEnd == undefined;
  }

  /** Data received recently. */
  #isStreaming(): boolean {
    return Date.now() - this.#lastDataWallMs < LIVE_DATA_TIMEOUT_MS;
  }

  /** Last message of `topic` at or before `time`. */
  #latestAt(topic: string, time: Time): MessageEvent | undefined {
    const events = this.#history.get(topic);
    if (!events) {
      return undefined;
    }
    return events[upperBound(events, time, { inclusive: false }) - 1];
  }

  #backfill(topics: Iterable<string>, time: Time): MessageEvent[] {
    const out: MessageEvent[] = [];
    for (const topic of topics) {
      const msgEvent = this.#latestAt(topic, time);
      if (msgEvent) {
        out.push(msgEvent);
      }
    }
    return out.sort((a, b) => compare(a.receiveTime, b.receiveTime));
  }

  /** Messages of `topics` with from < time <= to, sorted by time. */
  #collect(topics: Iterable<string>, from: Time, to: Time): MessageEvent[] {
    const out: MessageEvent[] = [];
    for (const topic of topics) {
      const events = this.#history.get(topic);
      if (!events) {
        continue;
      }
      const first = upperBound(events, from, { inclusive: false });
      const last = upperBound(events, to, { inclusive: false });
      for (let i = first; i < last; i++) {
        out.push(events[i]!);
      }
    }
    return out.sort((a, b) => compare(a.receiveTime, b.receiveTime));
  }

  /** Timeline range: announced by the server, extended by the received data. */
  #dataRange(): { start: Time; end: Time } | undefined {
    let start = this.#serverDataStart;
    let end = this.#serverDataEnd;
    if (this.#historyStart && (!start || isLessThan(this.#historyStart, start))) {
      start = this.#historyStart;
    }
    if (this.#historyEnd && (!end || isGreaterThan(this.#historyEnd, end))) {
      end = this.#historyEnd;
    }
    return start && end ? { start, end } : undefined;
  }

  /** Part of the timeline already received (shown as loaded on the timeline). */
  #loadedRanges(): { start: number; end: number }[] {
    const range = this.#dataRange();
    if (!range || !this.#historyStart || !this.#historyEnd) {
      return [];
    }
    const duration = toSec(subtract(range.end, range.start));
    if (duration <= 0) {
      return [{ start: 0, end: 1 }];
    }
    const fraction = (time: Time) =>
      Math.min(1, Math.max(0, toSec(subtract(time, range.start)) / duration));
    return [{ start: fraction(this.#historyStart), end: fraction(this.#historyEnd) }];
  }

  /**
   * New data for a topic: replace its Topic object (a new reference) once the data settles. Panels
   * using message ranges (Plot) then reload the topic's full history from memory.
   */
  #markTopicDirty(topic: string): void {
    this.#dirtyTopics.add(topic);
    this.#dirtySinceMs ??= Date.now();
    if (this.#dirtyFlushTimer != undefined) {
      clearTimeout(this.#dirtyFlushTimer);
    }
    // Debounce while a burst is arriving, but refresh at least every MAX_DIRTY_WAIT_MS.
    const waited = Date.now() - this.#dirtySinceMs;
    const delay = waited >= MAX_DIRTY_WAIT_MS ? 0 : DIRTY_DEBOUNCE_MS;
    this.#dirtyFlushTimer = setTimeout(this.#flushDirtyTopics, delay);
  }

  #flushDirtyTopics = (): void => {
    this.#dirtyFlushTimer = undefined;
    this.#dirtySinceMs = undefined;
    if (this.#dirtyTopics.size === 0 || !this.#topics) {
      return;
    }
    const dirty = this.#dirtyTopics;
    this.#dirtyTopics = new Set();
    this.#topics = this.#topics.map((topic) => (dirty.has(topic.name) ? { ...topic } : topic));
    this.#emitState();
  };

  // Return the current time
  //
  // For servers which publish a clock, we return that time. If the server disconnects we continue
  // to return the last known time. For servers which do not publish a clock, we use wall time.
  #getCurrentTime(): Time {
    // If the server does not publish the time, then we set the clock time to realtime as long as
    // the server is connected. When the server is not connected, time stops.
    if (!this.#serverPublishesTime) {
      this.#clockTime =
        this.#presence === PlayerPresence.PRESENT ? fromMillis(Date.now()) : this.#clockTime;
    }

    return this.#clockTime ?? ZERO_TIME;
  }

  #setupPublishers(): void {
    // This function will be called again once a connection is established
    if (!this.#client || this.#closed) {
      return;
    }

    if (this.#unresolvedPublications.length === 0) {
      return;
    }

    this.#alerts.removeAlerts((id) => id.startsWith("pub:"));

    for (const publication of this.#unresolvedPublications) {
      this.#advertiseChannel(publication);
    }

    this.#unresolvedPublications = [];
    this.#emitState();
  }

  #advertiseChannel(publication: AdvertiseOptions) {
    if (!this.#client) {
      return;
    }

    const encoding = this.#supportedEncodings
      ? this.#supportedEncodings.find((e) => SUPPORTED_PUBLICATION_ENCODINGS.includes(e))
      : FALLBACK_PUBLICATION_ENCODING;

    const { topic, schemaName, options } = publication;

    const encodingAlertId = `pub:encoding:${topic}`;
    const msgdefAlertId = `pub:msgdef:${topic}`;

    if (!encoding) {
      this.#alerts.addAlert(encodingAlertId, {
        severity: "warn",
        message: `Cannot advertise topic '${topic}': Server does not support one of the following encodings for client-side publishing: ${SUPPORTED_PUBLICATION_ENCODINGS}`,
      });
      return;
    }

    let messageWriter: Publication["messageWriter"] = undefined;
    if (ROS_ENCODINGS.includes(encoding)) {
      // Try to retrieve the ROS message definition for this topic
      let msgdef: MessageDefinition[];
      try {
        const datatypes =
          (options?.["datatypes"] as MessageDefinitionMap | undefined) ?? this.#datatypes;
        if (!(datatypes instanceof Map)) {
          throw new Error("Datatypes option must be a map");
        }
        msgdef = rosDatatypesToMessageDefinition(datatypes, schemaName);
      } catch (error) {
        log.debug(error);
        this.#alerts.addAlert(msgdefAlertId, {
          severity: "warn",
          message: `Unknown message definition for "${topic}"`,
          tip: `Try subscribing to the topic "${topic}" before publishing to it`,
        });
        return;
      }

      messageWriter =
        encoding === "ros1" ? new Ros1MessageWriter(msgdef) : new Ros2MessageWriter(msgdef);
    }

    const channelId = this.#client.advertise({ topic, encoding, schemaName });
    this.#publicationsByTopic.set(topic, {
      id: channelId,
      topic,
      encoding,
      schemaName,
      messageWriter,
    });

    for (const alertId of [encodingAlertId, msgdefAlertId]) {
      if (this.#alerts.hasAlert(alertId)) {
        this.#alerts.removeAlert(alertId);
      }
    }
  }

  #unadvertiseChannel(channel: Publication) {
    if (!this.#client) {
      return;
    }

    this.#client.unadvertise(channel.id);
    this.#publicationsByTopic.delete(channel.topic);
    const alertIds = [`pub:encoding:${channel.topic}`, `pub:msgdef:${channel.topic}`];
    for (const alertId of alertIds) {
      if (this.#alerts.hasAlert(alertId)) {
        this.#alerts.removeAlert(alertId);
      }
    }
  }

  #resetSessionState(): void {
    this.#session++;
    this.#wakeLiveIterators();
    this.#startTime = undefined;
    this.#endTime = undefined;
    this.#clockTime = undefined;
    this.#history = new Map();
    this.#dirtyTopics = new Set();
    this.#historyStart = undefined;
    this.#historyEnd = undefined;
    this.#playbackTime = undefined;
    this.#isPlaying = false;
    this.#followLive = true;
    this.#untilTime = undefined;
    this.#stopTicking();
    this.#topicsStats = new Map();
    this.#parsedMessages = [];
    this.#receivedBytes = 0;
    this.#alerts.clear();
    this.#parameters = new Map();
    this.#fetchedAssets.clear();
    for (const [requestId, callback] of this.#fetchAssetRequests) {
      callback({
        op: BinaryOpcode.FETCH_ASSET_RESPONSE,
        status: FetchAssetStatus.ERROR,
        requestId,
        error: "WebSocket connection reset",
      });
    }
    this.#fetchAssetRequests.clear();
    this.#parameterTypeByName.clear();
    this.#messageSizeEstimateByTopic = {};
  }

  #updateDataTypes(datatypes: MessageDefinitionMap): void {
    let updatedDatatypes: MessageDefinitionMap | undefined = undefined;
    const maybeRos = ["ros1", "ros2"].includes(this.#profile ?? "");
    for (const [name, types] of datatypes) {
      const knownTypes = this.#datatypes.get(name);
      if (knownTypes && !isMsgDefEqual(types, knownTypes)) {
        this.#alerts.addAlert(`schema-changed-${name}`, {
          message: `Definition of schema '${name}' has changed during the server's runtime`,
          severity: "error",
        });
      } else {
        updatedDatatypes ??= new Map(this.#datatypes);
        updatedDatatypes.set(name, types);

        const fullTypeName = dataTypeToFullName(name);
        if (maybeRos && fullTypeName !== name) {
          updatedDatatypes.set(fullTypeName, {
            ...types,
            name: types.name ? dataTypeToFullName(types.name) : undefined,
          });
        }
      }
    }
    if (updatedDatatypes != undefined) {
      this.#datatypes = updatedDatatypes; // Signal that datatypes changed.
    }
  }
}

/** Playback tick period (ms). */
const TICK_INTERVAL_MS = 16;
/** Maximum wall time handled by one tick (ms), so a slow frame does not jump too far. */
const MAX_TICK_WALL_MS = 100;
/** Without new data for this long (ms), the stream is considered finished. */
const LIVE_DATA_TIMEOUT_MS = 1000;
/** Wait this long (ms) after the last message of a burst before panels reload a topic. */
const DIRTY_DEBOUNCE_MS = 200;
/** While data keeps streaming, reload topics at least this often (ms). */
const MAX_DIRTY_WAIT_MS = 2000;

function clampTime(time: Time, start: Time, end: Time): Time {
  if (isLessThan(time, start)) {
    return start;
  }
  if (isGreaterThan(time, end)) {
    return end;
  }
  return time;
}

/**
 * Index of the first event whose time is after `time` (or at/after it when `inclusive` is true),
 * in a time-sorted array.
 */
function upperBound(
  events: readonly MessageEvent[],
  time: Time,
  { inclusive }: { inclusive: boolean },
): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const cmp = compare(events[mid]!.receiveTime, time);
    if (cmp < 0 || (!inclusive && cmp === 0)) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}
