// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { debounce, isEqual, sortBy } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import { Sockets } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";
import { RosNode } from "@foxglove/ros2";
import { RosMsgDefinition } from "@foxglove/rosmsg";
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
} from "@foxglove/studio-base/players/types";
import rosDatatypesToMessageDefinition from "@foxglove/studio-base/util/rosDatatypesToMessageDefinition";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";

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
  private _domainId: number; // ROS 2 DDS (RTPS) domain
  private _rosNode?: RosNode; // Our ROS node when we're connected.
  private _id: string = uuidv4(); // Unique ID for this player.
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  private _closed = false; // Whether the player has been completely closed using close().
  private _providerTopics?: Topic[]; // Topics as advertised by peers
  private _providerTopicsStats = new Map<string, TopicStats>(); // topic names to topic statistics.
  private _providerDatatypes = new Map<string, RosMsgDefinition>(); // All known ROS 2 message definitions.
  private _publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  private _subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  // private _services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  // private _parameters = new Map<string, ParameterValue>(); // rosparams
  private _start?: Time; // The time at which we started playing.
  private _clockTime?: Time; // The most recent published `/clock` time, if available
  private _requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  private _updateTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _updateTopics().
  private _hasReceivedMessage = false;
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _presence: PlayerPresence = PlayerPresence.INITIALIZING;
  private _problems = new PlayerProblemManager();
  private _emitTimer?: ReturnType<typeof setTimeout>;
  private readonly _sourceId: string;

  public constructor({ domainId, metricsCollector, sourceId }: Ros2PlayerOpts) {
    log.info(`initializing Ros2Player (domainId=${domainId})`);
    this._domainId = domainId;
    this._metricsCollector = metricsCollector;
    this._start = this._getCurrentTime();
    this._metricsCollector.playerConstructed();
    this._sourceId = sourceId;

    this._importRos2MsgDefs();

    void this._open();
  }

  private _importRos2MsgDefs(): void {
    // Add common message definitions from ROS2 (rcl_interfaces, common_interfaces, etc)
    for (const dataType in ros2galactic) {
      const msgDef = (ros2galactic as Record<string, RosMsgDefinition>)[dataType]!;
      this._providerDatatypes.set(dataType, msgDef);
      this._providerDatatypes.set(dataTypeToFullName(dataType), msgDef);
    }

    // Add message definitions from foxglove schemas
    for (const schema of Object.values(foxgloveMessageSchemas)) {
      const { fields, rosMsgInterfaceName, rosFullInterfaceName } = generateRosMsgDefinition(
        schema,
        { rosVersion: 2 },
      );
      const msgDef: RosMsgDefinition = { name: rosMsgInterfaceName, definitions: fields };
      this._providerDatatypes.set(rosMsgInterfaceName, msgDef);
      this._providerDatatypes.set(rosFullInterfaceName, msgDef);
    }

    // Add the legacy foxglove_msgs/ImageMarkerArray message definition
    this._providerDatatypes.set("foxglove_msgs/ImageMarkerArray", {
      definitions: [
        { name: "markers", type: "visualization_msgs/ImageMarker", isComplex: true, isArray: true },
      ],
    });
    this._providerDatatypes.set("foxglove_msgs/msg/ImageMarkerArray", {
      definitions: [
        { name: "markers", type: "visualization_msgs/ImageMarker", isComplex: true, isArray: true },
      ],
    });
  }

  private _open = async (): Promise<void> => {
    if (this._closed || OsContextSingleton == undefined) {
      return;
    }
    this._presence = PlayerPresence.INITIALIZING;

    const net = await Sockets.Create();
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const udpSocketCreate = () => net.createUdpSocket();

    if (this._rosNode == undefined) {
      const rosNode = new RosNode({
        name: `/foxglovestudio_${OsContextSingleton.pid}`,
        domainId: this._domainId,
        udpSocketCreate,
        getNetworkInterfaces: OsContextSingleton.getNetworkInterfaces,
        log: rosLog,
      });
      this._rosNode = rosNode;

      // When new publications are discovered, immediately call _updateTopics()
      rosNode.on("discoveredPublication", (_pub) => debounce(() => this._updateTopics(), 500));

      // rosNode.on("paramUpdate", ({ key, value, prevValue, callerId }) => {
      //   log.debug("paramUpdate", key, value, prevValue, callerId);
      //   this._parameters = new Map(rosNode.parameters);
      // });
    }

    await this._rosNode.start();

    this._updateTopics();
    this._presence = PlayerPresence.PRESENT;
  };

  private _addProblemAndEmit(id: string, problem: PlayerProblem): void {
    this._problems.addProblem(id, problem);
    this._emitState();
  }

  private _clearPublishProblems({ skipEmit = false }: { skipEmit?: boolean } = {}) {
    if (
      this._problems.removeProblems(
        (id) =>
          id.startsWith("msgdef:") || id.startsWith("advertise:") || id.startsWith("publish:"),
      )
    ) {
      if (!skipEmit) {
        this._emitState();
      }
    }
  }

  private _topicsChanged = (newTopics: Topic[]): boolean => {
    if (!this._providerTopics || newTopics.length !== this._providerTopics.length) {
      return true;
    }
    return !isEqual(this._providerTopics, newTopics);
  };

  private _updateTopics = (): void => {
    if (this._updateTopicsTimeout) {
      clearTimeout(this._updateTopicsTimeout);
    }
    const rosNode = this._rosNode;
    if (!rosNode || this._closed) {
      return;
    }

    try {
      // Convert the map of topics to publication endpoints to a list of topics
      const topics: Topic[] = [];
      for (const [topic, endpoints] of rosNode.getPublishedTopics().entries()) {
        const dataTypes = new Set<string>();
        for (const endpoint of endpoints) {
          dataTypes.add(endpoint.rosDataType);
        }
        const dataType = dataTypes.values().next().value as string;
        const problemId = `subscription:${topic}`;
        if (dataTypes.size > 1 && !this._problems.hasProblem(problemId)) {
          const message = `Multiple data types for "${topic}": ${Array.from(dataTypes).join(", ")}`;
          this._problems.addProblem(problemId, {
            severity: "warn",
            message,
            tip: `Only data type "${dataType}" will be used`,
          });
        }

        topics.push({ name: topic, datatype: dataType });
      }

      // Sort them for easy comparison
      const sortedTopics: Topic[] = sortBy(topics, "name");

      if (this._providerTopics == undefined) {
        this._metricsCollector.initialized();
      }

      if (this._topicsChanged(sortedTopics)) {
        // Remove stats entries for removed topics
        const topicsSet = new Set<string>(topics.map((topic) => topic.name));
        for (const topic of this._providerTopicsStats.keys()) {
          if (!topicsSet.has(topic)) {
            this._providerTopicsStats.delete(topic);
          }
        }

        this._providerTopics = sortedTopics;

        // Try subscribing again, since we might be able to subscribe to additional topics
        this.setSubscriptions(this._requestedSubscriptions);
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
      this._updateConnectionGraph(rosNode);

      this._presence = PlayerPresence.PRESENT;
      this._emitState();
    } catch (error) {
      this._presence = PlayerPresence.INITIALIZING;
      this._addProblemAndEmit(Problem.Connection, {
        severity: "error",
        message: "ROS connection failed",
        tip: `Ensure a ROS 2 DDS system is running on the local network and UDP multicast is supported`,
        error,
      });
    } finally {
      // Regardless of what happens, update topics again in a little bit
      this._updateTopicsTimeout = setTimeout(this._updateTopics, 3000);
    }
  };

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  private _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const providerTopics = this._providerTopics;
    const start = this._start;
    if (!providerTopics || !start) {
      return this._listener({
        presence: this._presence,
        progress: {},
        capabilities: CAPABILITIES,
        profile: "ros2",
        playerId: this._id,
        problems: this._problems.problems(),
        activeData: undefined,
      });
    }

    // Time is always moving forward even if we don't get messages from the server.
    // If we are not connected, don't emit updates since we are not longer getting new data
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
      presence: this._presence,
      progress: {},
      capabilities: CAPABILITIES,
      profile: "ros2",
      name: "ROS2",
      playerId: this._id,
      problems: this._problems.problems(),
      urlState: {
        sourceId: this._sourceId,
        parameters: { url: String(this._domainId) },
      },

      activeData: {
        messages,
        totalBytesReceived: this._rosNode?.receivedBytes() ?? 0,
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
        topicStats: new Map(this._providerTopicsStats),
        datatypes: this._providerDatatypes,
        publishedTopics: this._publishedTopics,
        subscribedTopics: this._subscribedTopics,
        // services: this._services,
        // parameters: this._parameters,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  public close(): void {
    this._closed = true;
    if (this._rosNode) {
      void this._rosNode.shutdown();
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

    if (!this._rosNode || this._closed) {
      return;
    }

    // Subscribe to additional topics used by Ros2Player itself
    this._addInternalSubscriptions(subscriptions);

    // Filter down to topics we can actually subscribe to
    const availableTopicsByTopicName = getTopicsByTopicName(this._providerTopics ?? []);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);

    const publishedTopics = this._rosNode.getPublishedTopics();

    // Subscribe to all topics that we aren't subscribed to yet
    for (const topicName of topicNames) {
      const availableTopic = availableTopicsByTopicName[topicName];
      if (!availableTopic || this._rosNode.subscriptions.has(topicName)) {
        continue;
      }
      const dataType = availableTopic.datatype;

      // Find the first publisher for this topic to mimic its QoS history settings
      const rosEndpoint = publishedTopics.get(topicName)?.[0];
      if (!rosEndpoint) {
        this._problems.addProblem(`subscription:${topicName}`, {
          severity: "warn",
          message: `No publisher for "${topicName}" ("${dataType}")`,
          tip: `Publish "${topicName}"`,
        });
        continue;
      } else {
        this._problems.removeProblem(`subscription:${topicName}`);
      }

      // Try to retrieve the ROS message definition for this topic
      let msgDefinition: RosMsgDefinition[] | undefined;
      try {
        msgDefinition = rosDatatypesToMessageDefinition(this._providerDatatypes, dataType);
        this._problems.removeProblem(`msgdef:${topicName}`);
      } catch (error) {
        this._problems.addProblem(`msgdef:${topicName}`, {
          severity: "warn",
          message: `Unknown message definition for "${topicName}" ("${dataType}")`,
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

      const subscription = this._rosNode.subscribe({
        topic: topicName,
        dataType,
        durability,
        history: rosEndpoint.history,
        reliability,
        msgDefinition,
      });

      subscription.on("message", (timestamp, message, data, _pub) => {
        this._handleMessage(topicName, timestamp, message, dataType, data.byteLength, true);
        // Clear any existing subscription problems for this topic if we're receiving messages again.
        this._problems.removeProblem(`subscription:${topicName}`);
      });
      subscription.on("error", (err) => {
        log.error(`Subscription error for ${topicName}: ${err}`);
        this._problems.addProblem(`subscription:${topicName}`, {
          severity: "error",
          message: `Error receiving messages on "${topicName}"`,
          tip: `Report this error if you continue experiencing issues`,
          error: err,
        });
      });
    }

    // Unsubscribe from topics that we are subscribed to but shouldn't be.
    for (const topicName of this._rosNode.subscriptions.keys()) {
      if (!topicNames.includes(topicName)) {
        this._rosNode.unsubscribe(topicName);

        // Reset the message count for this topic
        this._providerTopicsStats.delete(topicName);
      }
    }
  }

  private _handleMessage = (
    topic: string,
    timestamp: Time,
    message: unknown,
    datatype: string,
    sizeInBytes: number,
    // This is a hot path so we avoid extra object allocation from a parameters struct
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    external: boolean,
  ): void => {
    if (this._providerTopics == undefined) {
      return;
    }

    const receiveTime = this._getCurrentTime();
    const publishTime = timestamp;

    if (external && !this._hasReceivedMessage) {
      this._hasReceivedMessage = true;
      this._metricsCollector.recordTimeToFirstMsgs();
    }

    if (message != undefined) {
      const msg: MessageEvent<unknown> = {
        topic,
        receiveTime,
        publishTime,
        message,
        sizeInBytes,
        schemaName: datatype,
      };
      this._parsedMessages.push(msg);
      this._handleInternalMessage(msg);
    }

    // Update the message count for this topic
    let stats = this._providerTopicsStats.get(topic);
    if (this._rosNode?.subscriptions.has(topic) === true) {
      if (!stats) {
        stats = { numMessages: 0 };
        this._providerTopicsStats.set(topic, stats);
      }
      stats.numMessages++;
      stats.firstMessageTime ??= receiveTime;
      if (stats.lastMessageTime == undefined) {
        stats.lastMessageTime = receiveTime;
      } else if (isGreaterThan(receiveTime, stats.lastMessageTime)) {
        stats.lastMessageTime = receiveTime;
      }
    }

    this._emitState();
  };

  public setPublishers(_publishers: AdvertiseOptions[]): void {
    if (!this._rosNode || this._closed) {
      return;
    }

    // Clear all problems related to publishing
    this._clearPublishProblems({ skipEmit: false });
    this._emitState();
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

  private _addInternalSubscriptions(subscriptions: SubscribePayload[]): void {
    // Always subscribe to /clock if available
    if (subscriptions.find((sub) => sub.topic === "/clock") == undefined) {
      subscriptions.unshift({
        topic: "/clock",
      });
    }
  }

  private _handleInternalMessage(msg: MessageEvent<unknown>): void {
    const maybeClockMsg = msg.message as { clock?: Time };
    if (msg.topic === "/clock" && maybeClockMsg.clock && !isNaN(maybeClockMsg.clock.sec)) {
      const time = maybeClockMsg.clock;
      const seconds = toSec(maybeClockMsg.clock);
      if (isNaN(seconds)) {
        return;
      }

      if (this._clockTime == undefined) {
        this._start = time;
      }

      this._clockTime = time;
      (msg as { receiveTime: Time }).receiveTime = this._getCurrentTime();
    }
  }

  private _updateConnectionGraph(_rosNode: RosNode): void {
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

  private _getCurrentTime(): Time {
    return this._clockTime ?? fromMillis(Date.now());
  }
}

function dataTypeToFullName(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/msg/${parts[1]}`;
  }
  return dataType;
}
