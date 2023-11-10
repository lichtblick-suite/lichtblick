// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";
import * as _ from "lodash-es";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import Log from "@foxglove/log";
import { parseChannel, ParsedChannel } from "@foxglove/mcap-support";
import { MessageDefinition, isMsgDefEqual } from "@foxglove/message-definition";
import CommonRosTypes from "@foxglove/rosmsg-msgs-common";
import { MessageWriter as Ros1MessageWriter } from "@foxglove/rosmsg-serialization";
import { MessageWriter as Ros2MessageWriter } from "@foxglove/rosmsg2-serialization";
import { fromMillis, fromNanoSec, isGreaterThan, isLessThan, Time } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import { Asset } from "@foxglove/studio-base/components/PanelExtensionAdapter";
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
  FetchAssetStatus,
  FetchAssetResponse,
  BinaryOpcode,
} from "@foxglove/ws-protocol";

import { JsonMessageWriter } from "./JsonMessageWriter";
import { MessageWriter } from "./MessageWriter";
import WorkerSocketAdapter from "./WorkerSocketAdapter";

const log = Log.getLogger(__dirname);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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
type MessageDefinitionMap = Map<string, MessageDefinition>;

/**
 * When the tab is inactive setTimeout's are throttled to at most once per second.
 * Because the MessagePipeline listener uses timeouts to resolve its promises, it throttles our ability to
 * emit a frame more than once per second. In the websocket player this was causing
 * an accumulation of messages that were waiting to be emitted, this could keep growing
 * indefinitely if the rate at which we emit a frame is low enough.
 * 1500MB
 */
const CURRENT_FRAME_MAXIMUM_SIZE_BYTES = 15e8;

export default class FoxgloveWebSocketPlayer implements Player {
  readonly #sourceId: string;

  #url: string; // WebSocket URL.
  #name: string;
  #client?: FoxgloveClient; // The client when we're connected.
  #id: string = uuidv4(); // Unique ID for this player session.
  #serverCapabilities: string[] = [];
  #playerCapabilities: (typeof PlayerCapabilities)[keyof typeof PlayerCapabilities][] = [];
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
  #hasReceivedMessage = false;
  #presence: PlayerPresence = PlayerPresence.INITIALIZING;
  #problems = new PlayerProblemManager();
  #numTimeSeeks = 0;
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

    this.#client = new FoxgloveClient({
      ws:
        typeof Worker !== "undefined"
          ? new WorkerSocketAdapter(this.#url, [FoxgloveClient.SUPPORTED_SUBPROTOCOL])
          : new WebSocket(this.#url, [FoxgloveClient.SUPPORTED_SUBPROTOCOL]),
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
      this.#problems.clear();
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
    });

    this.#client.on("error", (err) => {
      log.error(err);

      if (
        (err as unknown as undefined | { message?: string })?.message != undefined &&
        err.message.includes("insecure WebSocket connection")
      ) {
        this.#problems.addProblem("ws:connection-failed", {
          severity: "error",
          message: "Insecure WebSocket connection",
          tip: `Check that the WebSocket server at ${
            this.#url
          } is reachable and supports protocol version ${FoxgloveClient.SUPPORTED_SUBPROTOCOL}.`,
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

      this.#problems.addProblem("ws:connection-failed", {
        severity: "error",
        message: "Connection failed",
        tip: `Check that the WebSocket server at ${
          this.#url
        } is reachable and supports protocol version ${FoxgloveClient.SUPPORTED_SUBPROTOCOL}.`,
      });

      this.#emitState();
      this.#openTimeout = setTimeout(this.#open, 3000);
    });

    this.#client.on("serverInfo", (event) => {
      if (!Array.isArray(event.capabilities)) {
        this.#problems.addProblem("ws:invalid-capabilities", {
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
        this.#playerCapabilities = this.#playerCapabilities.concat(PlayerCapabilities.advertise);
        this.#setupPublishers();
      }
      if (event.capabilities.includes(ServerCapability.services)) {
        this.#serviceCallEncoding = event.supportedEncodings?.find((e) =>
          SUPPORTED_SERVICE_ENCODINGS.includes(e),
        );

        const problemId = "callService:unsupportedEncoding";
        if (this.#serviceCallEncoding) {
          this.#playerCapabilities = this.#playerCapabilities.concat(
            PlayerCapabilities.callServices,
          );
          this.#problems.removeProblem(problemId);
        } else {
          this.#problems.addProblem(problemId, {
            severity: "warn",
            message: `Calling services is disabled as no compatible encoding could be found. \
            The server supports [${event.supportedEncodings?.join(", ")}], \
            but Studio only supports [${SUPPORTED_SERVICE_ENCODINGS.join(", ")}]`,
          });
        }
      }

      if (event.capabilities.includes(ServerCapability.parameters)) {
        this.#playerCapabilities = this.#playerCapabilities.concat(
          PlayerCapabilities.getParameters,
          PlayerCapabilities.setParameters,
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
        this.#playerCapabilities = this.#playerCapabilities.concat(PlayerCapabilities.assets);
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

      const problem: PlayerProblem = {
        message: event.message,
        severity: statusLevelToProblemSeverity(event.level),
      };

      if (event.message === "Send buffer limit reached") {
        problem.tip =
          "Server is dropping messages to the client. Check if you are subscribing to large or frequent topics or adjust your server send buffer limit.";
      }

      this.#problems.addProblem(event.message, problem);
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
          this.#problems.addProblem(`schema:${channel.topic}`, {
            severity: "error",
            message: `Failed to parse channel schema on ${channel.topic}`,
            error,
          });
          this.#emitState();
          continue;
        }
        const existingChannel = this.#channelsByTopic.get(channel.topic);
        if (existingChannel && !_.isEqual(channel, existingChannel.channel)) {
          this.#problems.addProblem(`duplicate-topic:${channel.topic}`, {
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
            this.#problems.addProblem(`unadvertise:${id}`, {
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

    this.#client.on("message", ({ subscriptionId, data }) => {
      if (!this.#hasReceivedMessage) {
        this.#hasReceivedMessage = true;
        this.#metricsCollector.recordTimeToFirstMsgs();
      }
      const chanInfo = this.#resolvedSubscriptionsById.get(subscriptionId);
      if (!chanInfo) {
        const wasRecentlyCanceled = this.#recentlyCanceledSubscriptions.has(subscriptionId);
        if (!wasRecentlyCanceled) {
          this.#problems.addProblem(`message-missing-subscription:${subscriptionId}`, {
            severity: "warn",
            message: `Received message on unknown subscription id: ${subscriptionId}. This might be a WebSocket server bug.`,
          });
          this.#emitState();
        }
        return;
      }

      try {
        this.#receivedBytes += data.byteLength;
        const receiveTime = this.#getCurrentTime();
        const topic = chanInfo.channel.topic;
        this.#parsedMessages.push({
          topic,
          receiveTime,
          message: chanInfo.parsedChannel.deserialize(data),
          sizeInBytes: data.byteLength,
          schemaName: chanInfo.channel.schemaName,
        });
        this.#parsedMessagesBytes += data.byteLength;
        if (this.#parsedMessagesBytes > CURRENT_FRAME_MAXIMUM_SIZE_BYTES) {
          this.#problems.addProblem(`webSocketPlayer:parsedMessageCacheFull`, {
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
      } catch (error) {
        this.#problems.addProblem(`message:${chanInfo.channel.topic}`, {
          severity: "error",
          message: `Failed to parse message on ${chanInfo.channel.topic}`,
          error,
        });
      }
      this.#emitState();
    });

    this.#client.on("time", ({ timestamp }) => {
      if (!this.#serverPublishesTime) {
        return;
      }

      const time = fromNanoSec(timestamp);
      if (this.#clockTime != undefined && isLessThan(time, this.#clockTime)) {
        this.#numTimeSeeks++;
        this.#parsedMessages = [];
        this.#parsedMessagesBytes = 0;
      }

      this.#clockTime = time;
      this.#emitState();
    });

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
        const serviceProblemId = `service:${service.id}`;
        // If not explicitly given, derive request / response type name from the service type
        // (according to ROS convention).
        const requestType = service.request?.schemaName ?? `${service.type}_Request`;
        const responseType = service.response?.schemaName ?? `${service.type}_Response`;
        const requestMsgEncoding = service.request?.encoding ?? this.#serviceCallEncoding;
        const responseMsgEncoding = service.response?.encoding ?? this.#serviceCallEncoding;

        try {
          if (
            (service.request == undefined && service.requestSchema == undefined) ||
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

          const parsedRequest = parseChannel({
            messageEncoding: requestMsgEncoding,
            schema: {
              name: requestType,
              encoding: service.request?.schemaEncoding ?? defaultSchemaEncoding,
              data: textEncoder.encode(service.request?.schema ?? service.requestSchema),
            },
          });
          const parsedResponse = parseChannel({
            messageEncoding: responseMsgEncoding,
            schema: {
              name: responseType,
              encoding: service.response?.schemaEncoding ?? defaultSchemaEncoding,
              data: textEncoder.encode(service.response?.schema ?? service.responseSchema),
            },
          });
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
          this.#problems.removeProblem(serviceProblemId);
        } catch (error) {
          this.#problems.addProblem(serviceProblemId, {
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
        const serviceProblemId = `service:${serviceId}`;
        needsStateUpdate = this.#problems.removeProblem(serviceProblemId) || needsStateUpdate;
      }
      if (needsStateUpdate) {
        this.#emitState();
      }
    });

    this.#client.on("serviceCallResponse", (response) => {
      const responseCallback = this.#serviceResponseCbs.get(response.callId);
      if (!responseCallback) {
        this.#problems.addProblem(`callService:${response.callId}`, {
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
        problems: this.#problems.problems(),
        urlState: this.#urlState,
      });
    }

    const currentTime = this.#getCurrentTime();
    if (!this.#startTime || isLessThan(currentTime, this.#startTime)) {
      this.#startTime = currentTime;
    }
    if (!this.#endTime || isGreaterThan(currentTime, this.#endTime)) {
      this.#endTime = currentTime;
    }

    const messages = this.#parsedMessages;
    this.#parsedMessages = [];
    this.#parsedMessagesBytes = 0;
    return this.#listener({
      name: this.#name,
      presence: this.#presence,
      progress: {},
      capabilities: this.#playerCapabilities,
      profile: this.#profile,
      playerId: this.#id,
      problems: this.#problems.problems(),
      urlState: this.#urlState,

      activeData: {
        messages,
        totalBytesReceived: this.#receivedBytes,
        startTime: this.#startTime,
        endTime: this.#endTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        lastSeekTime: this.#numTimeSeeks,
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
    this.#client?.close();
    this.#metricsCollector.close();
    this.#hasReceivedMessage = false;
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
      !this.#playerCapabilities.includes(PlayerCapabilities.advertise)
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

    log.debug(`FoxgloveWebSocketPlayer.setParameter(key=${key}, value=${value})`);
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
      this.#client.sendMessage(clientChannel.id, message);
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
        } catch (error) {
          reject(error);
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

    this.#problems.removeProblems((id) => id.startsWith("pub:"));

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

    const encodingProblemId = `pub:encoding:${topic}`;
    const msgdefProblemId = `pub:msgdef:${topic}`;

    if (!encoding) {
      this.#problems.addProblem(encodingProblemId, {
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
        this.#problems.addProblem(msgdefProblemId, {
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

    for (const problemId of [encodingProblemId, msgdefProblemId]) {
      if (this.#problems.hasProblem(problemId)) {
        this.#problems.removeProblem(problemId);
      }
    }
  }

  #unadvertiseChannel(channel: Publication) {
    if (!this.#client) {
      return;
    }

    this.#client.unadvertise(channel.id);
    this.#publicationsByTopic.delete(channel.topic);
    const problemIds = [`pub:encoding:${channel.topic}`, `pub:msgdef:${channel.topic}`];
    for (const problemId of problemIds) {
      if (this.#problems.hasProblem(problemId)) {
        this.#problems.removeProblem(problemId);
      }
    }
  }

  #resetSessionState(): void {
    this.#startTime = undefined;
    this.#endTime = undefined;
    this.#clockTime = undefined;
    this.#topicsStats = new Map();
    this.#parsedMessages = [];
    this.#receivedBytes = 0;
    this.#hasReceivedMessage = false;
    this.#problems.clear();
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
  }

  #updateDataTypes(datatypes: MessageDefinitionMap): void {
    let updatedDatatypes: MessageDefinitionMap | undefined = undefined;
    const maybeRos = ["ros1", "ros2"].includes(this.#profile ?? "");
    for (const [name, types] of datatypes) {
      const knownTypes = this.#datatypes.get(name);
      if (knownTypes && !isMsgDefEqual(types, knownTypes)) {
        this.#problems.addProblem(`schema-changed-${name}`, {
          message: `Definition of schema '${name}' has changed during the server's runtime`,
          severity: "error",
        });
      } else {
        if (updatedDatatypes == undefined) {
          updatedDatatypes = new Map(this.#datatypes);
        }
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
