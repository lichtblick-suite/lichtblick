// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";
import { isEqual } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import Log from "@foxglove/log";
import { parseChannel, ParsedChannel } from "@foxglove/mcap-support";
import { MessageDefinition } from "@foxglove/message-definition";
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
  PlayerProblem,
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
  Service,
  ServiceCallPayload,
  ServiceCallRequest,
  ServiceCallResponse,
  Parameter,
  StatusLevel,
} from "@foxglove/ws-protocol";

import { JsonMessageWriter } from "./JsonMessageWriter";
import { MessageWriter } from "./MessageWriter";
import WorkerSocketAdapter from "./WorkerSocketAdapter";

const log = Log.getLogger(__dirname);
const textEncoder = new TextEncoder();

/** Suppress warnings about messages on unknown subscriptions if the susbscription was recently canceled. */
const SUBSCRIPTION_WARNING_SUPPRESSION_MS = 2000;

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });
const GET_ALL_PARAMS_REQUEST_ID = "get-all-params";
const GET_ALL_PARAMS_PERIOD_MS = 15000;
const ROS_ENCODINGS = ["ros1", "cdr"];
const SUPPORTED_PUBLICATION_ENCODINGS = ["json", ...ROS_ENCODINGS];
const FALLBACK_PUBLICATION_ENCODING = "json";
const SUPPORTED_SERVICE_ENCODINGS = ["json", ...ROS_ENCODINGS];

type ResolvedChannel = { channel: Channel; parsedChannel: ParsedChannel };
type Publication = ClientChannel & { messageWriter?: Ros1MessageWriter | Ros2MessageWriter };
type ResolvedService = {
  service: Service;
  parsedResponse: ParsedChannel;
  requestMessageWriter: MessageWriter;
};

export default class FoxgloveWebSocketPlayer implements Player {
  private readonly _sourceId: string;

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
  private _datatypes: RosDatatypes = new Map(); // Datatypes as published by the WebSocket.
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  private _receivedBytes: number = 0;
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _hasReceivedMessage = false;
  private _presence: PlayerPresence = PlayerPresence.INITIALIZING;
  private _problems = new PlayerProblemManager();
  private _numTimeSeeks = 0;
  private _profile?: string;
  private _urlState: PlayerState["urlState"];

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
  private _getParameterInterval?: ReturnType<typeof setInterval>;
  private _openTimeout?: ReturnType<typeof setInterval>;
  private _connectionAttemptTimeout?: ReturnType<typeof setInterval>;
  private _unresolvedPublications: AdvertiseOptions[] = [];
  private _publicationsByTopic = new Map<string, Publication>();
  private _serviceCallEncoding?: string;
  private _servicesByName = new Map<string, ResolvedService>();
  private _serviceResponseCbs = new Map<
    ServiceCallRequest["callId"],
    (response: ServiceCallResponse) => void
  >();
  private _publishedTopics?: Map<string, Set<string>>;
  private _subscribedTopics?: Map<string, Set<string>>;
  private _advertisedServices?: Map<string, Set<string>>;
  private _nextServiceCallId = 0;

  public constructor({
    url,
    metricsCollector,
    sourceId,
  }: {
    url: string;
    metricsCollector: PlayerMetricsCollectorInterface;
    sourceId: string;
  }) {
    this._metricsCollector = metricsCollector;
    this._url = url;
    this._name = url;
    this._metricsCollector.playerConstructed();
    this._sourceId = sourceId;
    this._urlState = {
      sourceId: this._sourceId,
      parameters: { url: this._url },
    };
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

    // Set a timeout to abort the connection if we are still not connected by then.
    // This will abort hanging connection attempts that can for whatever reason not
    // establish a connection with the server.
    this._connectionAttemptTimeout = setTimeout(() => {
      this._client?.close();
    }, 10000);

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
      if (this._connectionAttemptTimeout != undefined) {
        clearTimeout(this._connectionAttemptTimeout);
      }
      this._presence = PlayerPresence.PRESENT;
      this._problems.clear();
      this._channelsById.clear();
      this._channelsByTopic.clear();
      this._setupPublishers();
      this._servicesByName.clear();
      this._serviceResponseCbs.clear();
      this._parameters.clear();
      this._profile = undefined;
      this._publishedTopics = undefined;
      this._subscribedTopics = undefined;
      this._advertisedServices = undefined;

      this._datatypes = new Map();

      for (const topic of this._resolvedSubscriptionsByTopic.keys()) {
        this._unresolvedSubscriptions.add(topic);
      }
      this._resolvedSubscriptionsById.clear();
      this._resolvedSubscriptionsByTopic.clear();
    });

    this._client.on("error", (err) => {
      log.error(err);

      if (
        (err as unknown as undefined | { message?: string })?.message != undefined &&
        err.message.includes("insecure WebSocket connection")
      ) {
        this._problems.addProblem("ws:connection-failed", {
          severity: "error",
          message: "Insecure WebSocket connection",
          tip: `Check that the WebSocket server at ${this._url} is reachable and supports protocol version ${FoxgloveClient.SUPPORTED_SUBPROTOCOL}.`,
        });
        this._emitState();
      }
    });

    // Note: We've observed closed being called not only when an already open connection is closed
    // but also when a new connection fails to open
    //
    // Note: We explicitly avoid clearing state like start/end times, datatypes, etc to preserve
    // this during a disconnect event. Any necessary state clearing is handled once a new connection
    // is established
    this._client.on("close", (event) => {
      log.info("Connection closed:", event);
      this._presence = PlayerPresence.RECONNECTING;

      if (this._getParameterInterval != undefined) {
        clearInterval(this._getParameterInterval);
        this._getParameterInterval = undefined;
      }
      if (this._connectionAttemptTimeout != undefined) {
        clearTimeout(this._connectionAttemptTimeout);
      }

      this._client?.close();
      this._client = undefined;

      this._problems.addProblem("ws:connection-failed", {
        severity: "error",
        message: "Connection failed",
        tip: `Check that the WebSocket server at ${this._url} is reachable and supports protocol version ${FoxgloveClient.SUPPORTED_SUBPROTOCOL}.`,
      });

      this._emitState();
      this._openTimeout = setTimeout(this._open, 3000);
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

      // If the server publishes the time we clear any existing clockTime we might have and let the
      // server override
      if (this._serverPublishesTime) {
        this._clockTime = undefined;
      }

      const maybeRosDistro = event.metadata?.["ROS_DISTRO"];
      if (maybeRosDistro) {
        const rosDistro = maybeRosDistro;
        const isRos1 = ["melodic", "noetic"].includes(rosDistro);
        this._profile = isRos1 ? "ros1" : "ros2";

        // Add common ROS message definitions
        const rosDataTypes = isRos1
          ? CommonRosTypes.ros1
          : ["foxy", "galactic"].includes(rosDistro)
          ? CommonRosTypes.ros2galactic
          : CommonRosTypes.ros2humble;

        for (const dataType in rosDataTypes) {
          const msgDef = (rosDataTypes as Record<string, MessageDefinition>)[dataType]!;
          this._datatypes.set(dataType, msgDef);
          this._datatypes.set(dataTypeToFullName(dataType), msgDef);
        }
        this._datatypes = new Map(this._datatypes); // Signal that datatypes changed.
      }

      if (event.capabilities.includes(ServerCapability.clientPublish)) {
        this._playerCapabilities = this._playerCapabilities.concat(PlayerCapabilities.advertise);
      }
      if (event.capabilities.includes(ServerCapability.services)) {
        this._serviceCallEncoding = event.supportedEncodings?.find((e) =>
          SUPPORTED_SERVICE_ENCODINGS.includes(e),
        );

        const problemId = "callService:unsupportedEncoding";
        if (this._serviceCallEncoding) {
          this._playerCapabilities = this._playerCapabilities.concat(
            PlayerCapabilities.callServices,
          );
          this._problems.removeProblem(problemId);
        } else {
          this._problems.addProblem(problemId, {
            severity: "warn",
            message: `Calling services is disabled as no compatible encoding could be found. \
            The server supports [${event.supportedEncodings?.join(", ")}], \
            but Studio only supports [${SUPPORTED_SERVICE_ENCODINGS.join(", ")}]`,
          });
        }
      }

      if (event.capabilities.includes(ServerCapability.parameters)) {
        this._playerCapabilities = this._playerCapabilities.concat(
          PlayerCapabilities.getParameters,
          PlayerCapabilities.setParameters,
        );

        // Periodically request all available parameters.
        this._getParameterInterval = setInterval(() => {
          this._client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
        }, GET_ALL_PARAMS_PERIOD_MS);

        this._client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
      }

      if (event.capabilities.includes(ServerCapability.connectionGraph)) {
        this._client?.subscribeConnectionGraph();
      }

      this._emitState();
    });

    this._client.on("status", (event) => {
      const msg = `FoxgloveWebSocket: ${event.message}`;
      if (event.level === StatusLevel.INFO) {
        log.info(msg);
      } else if (event.level === StatusLevel.WARNING) {
        log.warn(msg);
      } else {
        log.error(msg);
      }

      const problem: PlayerProblem = {
        message: event.message,
        severity: statusLevelToProblemSeverity(event.level),
      };

      if (event.message === "Send buffer limit reached") {
        problem.tip =
          "Server is dropping messages to the client. Check if you are subscribing to large or frequent topics or adjust your server send buffer limit.";
      }

      this._problems.addProblem(event.message, problem);
      this._emitState();
    });

    this._client.on("advertise", (newChannels) => {
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
              ["ros2idl", "ros2msg"].includes(channel.schemaEncoding))
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
          message: chanInfo.parsedChannel.deserialize(data),
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
      const newParameters = parameters.filter((param) => !this._parameters.has(param.name));

      if (id === GET_ALL_PARAMS_REQUEST_ID) {
        // Reset params
        this._parameters = new Map(parameters.map((param) => [param.name, param.value]));
      } else {
        // Update params
        parameters.forEach((param) => this._parameters.set(param.name, param.value));
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

    this._client.on("advertiseServices", (services) => {
      if (!this._serviceCallEncoding) {
        return;
      }

      let schemaEncoding: string;
      if (this._serviceCallEncoding === "json") {
        schemaEncoding = "jsonschema";
      } else if (this._serviceCallEncoding === "ros1") {
        schemaEncoding = "ros1msg";
      } else if (this._serviceCallEncoding === "cdr") {
        schemaEncoding = "ros2msg";
      } else {
        throw new Error(`Unsupported encoding "${this._serviceCallEncoding}"`);
      }

      for (const service of services) {
        const requestType = `${service.type}_Request`;
        const responseType = `${service.type}_Response`;
        const parsedRequest = parseChannel({
          messageEncoding: this._serviceCallEncoding,
          schema: {
            name: requestType,
            encoding: schemaEncoding,
            data: textEncoder.encode(service.requestSchema),
          },
        });
        const parsedResponse = parseChannel({
          messageEncoding: this._serviceCallEncoding,
          schema: {
            name: responseType,
            encoding: schemaEncoding,
            data: textEncoder.encode(service.responseSchema),
          },
        });
        const requestMsgDef = rosDatatypesToMessageDefinition(parsedRequest.datatypes, requestType);
        const requestMessageWriter = ROS_ENCODINGS.includes(this._serviceCallEncoding)
          ? this._serviceCallEncoding === "ros1"
            ? new Ros1MessageWriter(requestMsgDef)
            : new Ros2MessageWriter(requestMsgDef)
          : new JsonMessageWriter();

        // Add type definitions for service response and request
        for (const [name, types] of [...parsedRequest.datatypes, ...parsedResponse.datatypes]) {
          this._datatypes.set(name, types);
        }
        this._datatypes = new Map(this._datatypes); // Signal that datatypes changed.

        const resolvedService: ResolvedService = {
          service,
          parsedResponse,
          requestMessageWriter,
        };
        this._servicesByName.set(service.name, resolvedService);
      }
      this._emitState();
    });

    this._client.on("unadvertiseServices", (serviceIds) => {
      for (const serviceId of serviceIds) {
        const service: ResolvedService | undefined = Object.values(this._servicesByName).find(
          (srv) => srv.service.id === serviceId,
        );
        if (service) {
          this._servicesByName.delete(service.service.name);
        }
      }
    });

    this._client.on("serviceCallResponse", (response) => {
      const responseCallback = this._serviceResponseCbs.get(response.callId);
      if (!responseCallback) {
        this._problems.addProblem(`callService:${response.callId}`, {
          severity: "error",
          message: `Received a response for a service for which no callback was registered`,
        });
        return;
      }
      responseCallback(response);
      this._serviceResponseCbs.delete(response.callId);
    });

    this._client.on("connectionGraphUpdate", (event) => {
      if (event.publishedTopics.length > 0 || event.removedTopics.length > 0) {
        const newMap: Map<string, Set<string>> = new Map(this._publishedTopics ?? new Map());
        for (const { name, publisherIds } of event.publishedTopics) {
          newMap.set(name, new Set(publisherIds));
        }
        event.removedTopics.forEach((topic) => newMap.delete(topic));
        this._publishedTopics = newMap;
      }
      if (event.subscribedTopics.length > 0 || event.removedTopics.length > 0) {
        const newMap: Map<string, Set<string>> = new Map(this._subscribedTopics ?? new Map());
        for (const { name, subscriberIds } of event.subscribedTopics) {
          newMap.set(name, new Set(subscriberIds));
        }
        event.removedTopics.forEach((topic) => newMap.delete(topic));
        this._subscribedTopics = newMap;
      }
      if (event.advertisedServices.length > 0 || event.removedServices.length > 0) {
        const newMap: Map<string, Set<string>> = new Map(this._advertisedServices ?? new Map());
        for (const { name, providerIds } of event.advertisedServices) {
          newMap.set(name, new Set(providerIds));
        }
        event.removedServices.forEach((service) => newMap.delete(service));
        this._advertisedServices = newMap;
      }

      this._emitState();
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

    // Update the _datatypes map;
    for (const { parsedChannel } of this._channelsById.values()) {
      for (const [name, types] of parsedChannel.datatypes) {
        this._datatypes.set(name, types);
      }
    }
    this._datatypes = new Map(this._datatypes); // Signal that datatypes changed.
    this._emitState();
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  private _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    if (!this._topics) {
      return this._listener({
        name: this._name,
        presence: this._presence,
        progress: {},
        capabilities: this._playerCapabilities,
        profile: undefined,
        playerId: this._id,
        activeData: undefined,
        problems: this._problems.problems(),
        urlState: this._urlState,
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
      profile: this._profile,
      playerId: this._id,
      problems: this._problems.problems(),
      urlState: this._urlState,

      activeData: {
        messages,
        totalBytesReceived: this._receivedBytes,
        startTime: this._startTime,
        endTime: this._endTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        lastSeekTime: this._numTimeSeeks,
        topics: this._topics,
        // Always copy topic stats since message counts and timestamps are being updated
        topicStats: new Map(this._topicsStats),
        datatypes: this._datatypes,
        parameters: new Map(this._parameters),
        publishedTopics: this._publishedTopics,
        subscribedTopics: this._subscribedTopics,
        services: this._advertisedServices,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  public close(): void {
    this._closed = true;
    this._client?.close();
    this._metricsCollector.close();
    this._hasReceivedMessage = false;
    if (this._openTimeout != undefined) {
      clearTimeout(this._openTimeout);
      this._openTimeout = undefined;
    }
    if (this._getParameterInterval != undefined) {
      clearInterval(this._getParameterInterval);
      this._getParameterInterval = undefined;
    }
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
    this._client.setParameters([{ name: key, value: value as Parameter["value"] }], uuidv4());

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
      // Ensure that typed arrays are encoded as arrays and not objects.
      const replacer = (_key: string, value: unknown) => {
        return ArrayBuffer.isView(value)
          ? Array.from(value as unknown as ArrayLike<unknown>)
          : value;
      };
      const message = Buffer.from(JSON.stringify(msg, replacer) ?? "");
      this._client.sendMessage(clientChannel.id, message);
    } else if (
      ROS_ENCODINGS.includes(clientChannel.encoding) &&
      clientChannel.messageWriter != undefined
    ) {
      const message = clientChannel.messageWriter.writeMessage(msg);
      this._client.sendMessage(clientChannel.id, message);
    }
  }

  public async callService(serviceName: string, request: unknown): Promise<unknown> {
    if (!this._client) {
      throw new Error(
        `Attempted to call service ${serviceName} without a valid Foxglove WebSocket connection.`,
      );
    }

    if (request == undefined || typeof request !== "object") {
      throw new Error("FoxgloveWebSocketPlayer#callService request must be an object.");
    }

    const resolvedService = this._servicesByName.get(serviceName);
    if (!resolvedService) {
      throw new Error(
        `Tried to call service '${serviceName}' that has not been advertised before.`,
      );
    }

    const { service, parsedResponse, requestMessageWriter } = resolvedService;

    const serviceCallRequest: ServiceCallPayload = {
      serviceId: service.id,
      callId: ++this._nextServiceCallId,
      encoding: this._serviceCallEncoding!,
      data: new DataView(new Uint8Array().buffer),
    };

    const message = requestMessageWriter.writeMessage(request);
    serviceCallRequest.data = new DataView(message.buffer);
    this._client.sendServiceCallRequest(serviceCallRequest);

    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      this._serviceResponseCbs.set(serviceCallRequest.callId, (response: ServiceCallResponse) => {
        try {
          const data = parsedResponse.deserialize(response.data);
          resolve(data as Record<string, unknown>);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public setGlobalVariables(): void {}

  // Return the current time
  //
  // For servers which publish a clock, we return that time. If the server disconnects we continue
  // to return the last known time. For servers which do not publish a clock, we use wall time.
  private _getCurrentTime(): Time {
    // If the server does not publish the time, then we set the clock time to realtime as long as
    // the server is connected. When the server is not connected, time stops.
    if (!this._serverPublishesTime) {
      this._clockTime =
        this._presence === PlayerPresence.PRESENT ? fromMillis(Date.now()) : this._clockTime;
    }

    return this._clockTime ?? ZERO_TIME;
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
        let msgdef: MessageDefinition[];
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

function statusLevelToProblemSeverity(level: StatusLevel): PlayerProblem["severity"] {
  if (level === StatusLevel.INFO) {
    return "info";
  } else if (level === StatusLevel.WARNING) {
    return "warn";
  } else {
    return "error";
  }
}
