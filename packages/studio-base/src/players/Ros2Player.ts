// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { debounce, isEqual, sortBy, keyBy } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import { Sockets } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";
import { MessageDefinition } from "@foxglove/message-definition";
import { RosNode } from "@foxglove/ros2";
import { ros2galactic } from "@foxglove/rosmsg-msgs-common";
import { Time, fromMillis, toSec, isGreaterThan } from "@foxglove/rostime";
import { Durability, Reliability } from "@foxglove/rtps";
import { foxgloveMessageSchemas, generateRosMsgDefinition } from "@foxglove/schemas/internal";
import { ParameterValue } from "@foxglove/studio";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerProblem,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
  TopicWithSchemaName,
} from "@foxglove/studio-base/players/types";
import rosDatatypesToMessageDefinition from "@foxglove/studio-base/util/rosDatatypesToMessageDefinition";

const log = Logger.getLogger(__filename);
const rosLog = Logger.getLogger("ROS2");

const CAPABILITIES: string[] = [];

enum Problem {
  Connection = "Connection",
  Parameters = "Parameters",
  Graph = "Graph",
  Publish = "Publish",
}

type Ros2PlayerOpts = {
  domainId: number;
  metricsCollector: PlayerMetricsCollectorInterface;
  sourceId: string;
};

// Connects to a ROS 2 network using RTPS over UDP, discovering peers via UDP multicast.
export default class Ros2Player implements Player {
  #domainId: number; // ROS 2 DDS (RTPS) domain
  #rosNode?: RosNode; // Our ROS node when we're connected.
  #id: string = uuidv4(); // Unique ID for this player.
  #listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  #closed = false; // Whether the player has been completely closed using close().
  #providerTopics?: TopicWithSchemaName[]; // Topics as advertised by peers
  #providerTopicsStats = new Map<string, TopicStats>(); // topic names to topic statistics.
  #providerDatatypes = new Map<string, MessageDefinition>(); // All known ROS 2 message definitions.
  #publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  #subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  // private _services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  // private _parameters = new Map<string, ParameterValue>(); // rosparams
  #start?: Time; // The time at which we started playing.
  #clockTime?: Time; // The most recent published `/clock` time, if available
  #requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  #parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  #updateTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _updateTopics().
  #hasReceivedMessage = false;
  #metricsCollector: PlayerMetricsCollectorInterface;
  #presence: PlayerPresence = PlayerPresence.INITIALIZING;
  #problems = new PlayerProblemManager();
  #emitTimer?: ReturnType<typeof setTimeout>;
  readonly #sourceId: string;

  public constructor({ domainId, metricsCollector, sourceId }: Ros2PlayerOpts) {
    log.info(`initializing Ros2Player (domainId=${domainId})`);
    this.#domainId = domainId;
    this.#metricsCollector = metricsCollector;
    this.#start = this.#getCurrentTime();
    this.#metricsCollector.playerConstructed();
    this.#sourceId = sourceId;

    this.#importRos2MsgDefs();

    void this.#open();
  }

  #importRos2MsgDefs(): void {
    // Add common message definitions from ROS2 (rcl_interfaces, common_interfaces, etc)
    for (const dataType in ros2galactic) {
      const msgDef = (ros2galactic as Record<string, MessageDefinition>)[dataType]!;
      this.#providerDatatypes.set(dataType, msgDef);
      this.#providerDatatypes.set(dataTypeToFullName(dataType), msgDef);
    }

    // Add message definitions from foxglove schemas
    for (const schema of Object.values(foxgloveMessageSchemas)) {
      const { fields, rosMsgInterfaceName, rosFullInterfaceName } = generateRosMsgDefinition(
        schema,
        { rosVersion: 2 },
      );
      const msgDef: MessageDefinition = { name: rosMsgInterfaceName, definitions: fields };
      this.#providerDatatypes.set(rosMsgInterfaceName, msgDef);
      this.#providerDatatypes.set(rosFullInterfaceName, msgDef);
    }

    // Add the legacy foxglove_msgs/ImageMarkerArray message definition
    this.#providerDatatypes.set("foxglove_msgs/ImageMarkerArray", {
      definitions: [
        { name: "markers", type: "visualization_msgs/ImageMarker", isComplex: true, isArray: true },
      ],
    });
    this.#providerDatatypes.set("foxglove_msgs/msg/ImageMarkerArray", {
      definitions: [
        { name: "markers", type: "visualization_msgs/ImageMarker", isComplex: true, isArray: true },
      ],
    });
  }

  #open = async (): Promise<void> => {
    if (this.#closed || OsContextSingleton == undefined) {
      return;
    }
    this.#presence = PlayerPresence.INITIALIZING;

    const net = await Sockets.Create();
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const udpSocketCreate = () => net.createUdpSocket();

    if (this.#rosNode == undefined) {
      const rosNode = new RosNode({
        name: `/foxglovestudio_${OsContextSingleton.pid}`,
        domainId: this.#domainId,
        udpSocketCreate,
        getNetworkInterfaces: OsContextSingleton.getNetworkInterfaces,
        log: rosLog,
      });
      this.#rosNode = rosNode;

      // When new publications are discovered, immediately call _updateTopics()
      rosNode.on("discoveredPublication", (_pub) => debounce(() => this.#updateTopics(), 500));

      // rosNode.on("paramUpdate", ({ key, value, prevValue, callerId }) => {
      //   log.debug("paramUpdate", key, value, prevValue, callerId);
      //   this._parameters = new Map(rosNode.parameters);
      // });
    }

    await this.#rosNode.start();

    this.#updateTopics();
    this.#presence = PlayerPresence.PRESENT;
  };

  #addProblemAndEmit(id: string, problem: PlayerProblem): void {
    this.#problems.addProblem(id, problem);
    this.#emitState();
  }

  #clearPublishProblems({ skipEmit = false }: { skipEmit?: boolean } = {}) {
    if (
      this.#problems.removeProblems(
        (id) =>
          id.startsWith("msgdef:") || id.startsWith("advertise:") || id.startsWith("publish:"),
      )
    ) {
      if (!skipEmit) {
        this.#emitState();
      }
    }
  }

  #topicsChanged = (newTopics: Topic[]): boolean => {
    if (!this.#providerTopics || newTopics.length !== this.#providerTopics.length) {
      return true;
    }
    return !isEqual(this.#providerTopics, newTopics);
  };

  #updateTopics = (): void => {
    if (this.#updateTopicsTimeout) {
      clearTimeout(this.#updateTopicsTimeout);
    }
    const rosNode = this.#rosNode;
    if (!rosNode || this.#closed) {
      return;
    }

    try {
      // Convert the map of topics to publication endpoints to a list of topics
      const topics: TopicWithSchemaName[] = [];
      for (const [topic, endpoints] of rosNode.getPublishedTopics().entries()) {
        const dataTypes = new Set<string>();
        for (const endpoint of endpoints) {
          dataTypes.add(endpoint.rosDataType);
        }
        const dataType = dataTypes.values().next().value as string;
        const problemId = `subscription:${topic}`;
        if (dataTypes.size > 1 && !this.#problems.hasProblem(problemId)) {
          const message = `Multiple data types for "${topic}": ${Array.from(dataTypes).join(", ")}`;
          this.#problems.addProblem(problemId, {
            severity: "warn",
            message,
            tip: `Only data type "${dataType}" will be used`,
          });
        }

        topics.push({ name: topic, schemaName: dataType });
      }

      // Sort them for easy comparison
      const sortedTopics: TopicWithSchemaName[] = sortBy(topics, "name");

      if (this.#topicsChanged(sortedTopics)) {
        // Remove stats entries for removed topics
        const topicsSet = new Set<string>(topics.map((topic) => topic.name));
        for (const topic of this.#providerTopicsStats.keys()) {
          if (!topicsSet.has(topic)) {
            this.#providerTopicsStats.delete(topic);
          }
        }

        this.#providerTopics = sortedTopics;

        // Try subscribing again, since we might be able to subscribe to additional topics
        this.setSubscriptions(this.#requestedSubscriptions);
      }

      // Subscribe to all parameters
      // try {
      //   const params = await rosNode.subscribeAllParams();
      //   if (!isEqual(params, this._parameters)) {
      //     this._parameters = new Map();
      //     params.forEach((value, key) => this._parameters.set(key, value));
      //   }
      //   this._clearProblem(Problem.Parameters, true);
      // } catch (error) {
      //   this._addProblem(
      //     Problem.Parameters,
      //     {
      //       severity: "warn",
      //       message: "ROS parameter fetch failed",
      //       tip: `Ensure that roscore is running and accessible at: ${this._url}`,
      //       error,
      //     },
      //     true,
      //   );
      // }

      // Fetch the full graph topology
      this.#updateConnectionGraph(rosNode);

      this.#presence = PlayerPresence.PRESENT;
      this.#emitState();
    } catch (error) {
      this.#presence = PlayerPresence.INITIALIZING;
      this.#addProblemAndEmit(Problem.Connection, {
        severity: "error",
        message: "ROS connection failed",
        tip: `Ensure a ROS 2 DDS system is running on the local network and UDP multicast is supported`,
        error,
      });
    } finally {
      // Regardless of what happens, update topics again in a little bit
      this.#updateTopicsTimeout = setTimeout(this.#updateTopics, 3000);
    }
  };

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  #emitState = debouncePromise(() => {
    if (!this.#listener || this.#closed) {
      return Promise.resolve();
    }

    const providerTopics = this.#providerTopics;
    const start = this.#start;
    if (!providerTopics || !start) {
      return this.#listener({
        presence: this.#presence,
        progress: {},
        capabilities: CAPABILITIES,
        profile: "ros2",
        playerId: this.#id,
        problems: this.#problems.problems(),
        activeData: undefined,
      });
    }

    // Time is always moving forward even if we don't get messages from the server.
    // If we are not connected, don't emit updates since we are not longer getting new data
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
      presence: this.#presence,
      progress: {},
      capabilities: CAPABILITIES,
      profile: "ros2",
      name: "ROS2",
      playerId: this.#id,
      problems: this.#problems.problems(),
      urlState: {
        sourceId: this.#sourceId,
        parameters: { url: String(this.#domainId) },
      },

      activeData: {
        messages,
        totalBytesReceived: this.#rosNode?.receivedBytes() ?? 0,
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
        datatypes: this.#providerDatatypes,
        publishedTopics: this.#publishedTopics,
        subscribedTopics: this.#subscribedTopics,
        // services: this._services,
        // parameters: this._parameters,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    this.#emitState();
  }

  public close(): void {
    this.#closed = true;
    if (this.#rosNode) {
      void this.#rosNode.shutdown();
    }
    if (this.#emitTimer != undefined) {
      clearTimeout(this.#emitTimer);
      this.#emitTimer = undefined;
    }
    this.#metricsCollector.close();
    this.#hasReceivedMessage = false;
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.#requestedSubscriptions = subscriptions;

    if (!this.#rosNode || this.#closed) {
      return;
    }

    // Subscribe to additional topics used by Ros2Player itself
    this.#addInternalSubscriptions(subscriptions);

    // Filter down to topics we can actually subscribe to
    const availableTopicsByTopicName = keyBy(this.#providerTopics ?? [], ({ name }) => name);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);

    const publishedTopics = this.#rosNode.getPublishedTopics();

    // Subscribe to all topics that we aren't subscribed to yet
    for (const topicName of topicNames) {
      const availableTopic = availableTopicsByTopicName[topicName];
      if (!availableTopic || this.#rosNode.subscriptions.has(topicName)) {
        continue;
      }
      const schemaName = availableTopic.schemaName;

      // Find the first publisher for this topic to mimic its QoS history settings
      const rosEndpoint = publishedTopics.get(topicName)?.[0];
      if (!rosEndpoint) {
        this.#problems.addProblem(`subscription:${topicName}`, {
          severity: "warn",
          message: `No publisher for "${topicName}" ("${schemaName}")`,
          tip: `Publish "${topicName}"`,
        });
        continue;
      } else {
        this.#problems.removeProblem(`subscription:${topicName}`);
      }

      // Try to retrieve the ROS message definition for this topic
      let msgDefinition: MessageDefinition[] | undefined;
      try {
        msgDefinition = rosDatatypesToMessageDefinition(this.#providerDatatypes, schemaName);
        this.#problems.removeProblem(`msgdef:${topicName}`);
      } catch (error) {
        this.#problems.addProblem(`msgdef:${topicName}`, {
          severity: "warn",
          message: `Unknown message definition for "${topicName}" ("${schemaName}")`,
          tip: `Only core ROS 2 data types are currently supported`,
        });
      }

      // Pick the best but lowest common denominator QoS profile for this topic
      const topicEndpoints = publishedTopics.get(topicName) ?? [];
      const reliableCount = topicEndpoints.reduce(
        (sum, pub) => sum + (pub.reliability.kind === Reliability.Reliable ? 1 : 0),
        0,
      );
      const transientLocalCount = topicEndpoints.reduce(
        (sum, pub) => sum + (pub.durability === Durability.TransientLocal ? 1 : 0),
        0,
      );
      const endpointCount = topicEndpoints.length;
      const durability =
        transientLocalCount === endpointCount ? Durability.TransientLocal : Durability.Volatile;
      const reliability = {
        kind: reliableCount === endpointCount ? Reliability.Reliable : Reliability.BestEffort,
        maxBlockingTime: rosEndpoint.reliability.maxBlockingTime,
      };

      const subscription = this.#rosNode.subscribe({
        topic: topicName,
        dataType: schemaName,
        durability,
        history: rosEndpoint.history,
        reliability,
        msgDefinition,
      });

      subscription.on("message", (timestamp, message, data, _pub) => {
        this.#handleMessage(topicName, timestamp, message, schemaName, data.byteLength, true);
        // Clear any existing subscription problems for this topic if we're receiving messages again.
        this.#problems.removeProblem(`subscription:${topicName}`);
      });
      subscription.on("error", (err) => {
        log.error(`Subscription error for ${topicName}: ${err}`);
        this.#problems.addProblem(`subscription:${topicName}`, {
          severity: "error",
          message: `Error receiving messages on "${topicName}"`,
          tip: `Report this error if you continue experiencing issues`,
          error: err,
        });
      });
    }

    // Unsubscribe from topics that we are subscribed to but shouldn't be.
    for (const topicName of this.#rosNode.subscriptions.keys()) {
      if (!topicNames.includes(topicName)) {
        this.#rosNode.unsubscribe(topicName);

        // Reset the message count for this topic
        this.#providerTopicsStats.delete(topicName);
      }
    }
  }

  #handleMessage = (
    topic: string,
    timestamp: Time,
    message: unknown,
    schemaName: string,
    sizeInBytes: number,
    // This is a hot path so we avoid extra object allocation from a parameters struct
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    external: boolean,
  ): void => {
    if (this.#providerTopics == undefined) {
      return;
    }

    const receiveTime = this.#getCurrentTime();
    const publishTime = timestamp;

    if (external && !this.#hasReceivedMessage) {
      this.#hasReceivedMessage = true;
      this.#metricsCollector.recordTimeToFirstMsgs();
    }

    if (message != undefined) {
      const msg: MessageEvent<unknown> = {
        topic,
        receiveTime,
        publishTime,
        message,
        sizeInBytes,
        schemaName,
      };
      this.#parsedMessages.push(msg);
      this.#handleInternalMessage(msg);
    }

    // Update the message count for this topic
    let stats = this.#providerTopicsStats.get(topic);
    if (this.#rosNode?.subscriptions.has(topic) === true) {
      if (!stats) {
        stats = { numMessages: 0 };
        this.#providerTopicsStats.set(topic, stats);
      }
      stats.numMessages++;
      stats.firstMessageTime ??= receiveTime;
      if (stats.lastMessageTime == undefined) {
        stats.lastMessageTime = receiveTime;
      } else if (isGreaterThan(receiveTime, stats.lastMessageTime)) {
        stats.lastMessageTime = receiveTime;
      }
    }

    this.#emitState();
  };

  public setPublishers(_publishers: AdvertiseOptions[]): void {
    if (!this.#rosNode || this.#closed) {
      return;
    }

    // Clear all problems related to publishing
    this.#clearPublishProblems({ skipEmit: false });
    this.#emitState();
  }

  public setParameter(_key: string, _value: ParameterValue): void {
    throw new Error("Parameter editing is not supported by this data source");
  }

  public publish(_payload: PublishPayload): void {
    throw new Error("Publishing is not supported");
  }

  public async callService(): Promise<unknown> {
    throw new Error("Service calls are not supported by this data source");
  }

  // Bunch of unsupported stuff. Just don't do anything for these.
  public setGlobalVariables(): void {
    // no-op
  }

  #addInternalSubscriptions(subscriptions: SubscribePayload[]): void {
    // Always subscribe to /clock if available
    if (subscriptions.find((sub) => sub.topic === "/clock") == undefined) {
      subscriptions.unshift({
        topic: "/clock",
      });
    }
  }

  #handleInternalMessage(msg: MessageEvent<unknown>): void {
    const maybeClockMsg = msg.message as { clock?: Time };
    if (msg.topic === "/clock" && maybeClockMsg.clock && !isNaN(maybeClockMsg.clock.sec)) {
      const time = maybeClockMsg.clock;
      const seconds = toSec(maybeClockMsg.clock);
      if (isNaN(seconds)) {
        return;
      }

      if (this.#clockTime == undefined) {
        this.#start = time;
      }

      this.#clockTime = time;
      (msg as { receiveTime: Time }).receiveTime = this.#getCurrentTime();
    }
  }

  #updateConnectionGraph(_rosNode: RosNode): void {
    //     try {
    //       const graph = await rosNode.getSystemState();
    //       if (
    //         !isEqual(this._publishedTopics, graph.publishers) ||
    //         !isEqual(this._subscribedTopics, graph.subscribers) ||
    //         !isEqual(this._services, graph.services)
    //       ) {
    //         this._publishedTopics = graph.publishers;
    //         this._subscribedTopics = graph.subscribers;
    //         this._services = graph.services;
    //       }
    //       this._clearProblem(Problem.Graph, true);
    //     } catch (error) {
    //       this._addProblem(
    //         Problem.Graph,
    //         {
    //           severity: "warn",
    //           message: "Unable to update connection graph",
    //           tip: `The connection graph contains information about publishers and subscribers. A
    // stale graph may result in missing topics you expect. Ensure that roscore is reachable at ${this._url}.`,
    //           error,
    //         },
    //         true,
    //       );
    //       this._publishedTopics = new Map();
    //       this._subscribedTopics = new Map();
    //       this._services = new Map();
    //     }
  }

  #getCurrentTime(): Time {
    return this.#clockTime ?? fromMillis(Date.now());
  }
}

function dataTypeToFullName(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/msg/${parts[1]}`;
  }
  return dataType;
}
