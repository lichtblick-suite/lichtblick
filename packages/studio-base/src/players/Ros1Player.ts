// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual, sortBy } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import { Sockets } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";
import { RosNode, TcpSocket } from "@foxglove/ros1";
import { RosMsgDefinition } from "@foxglove/rosmsg";
import { Time, fromMillis, isGreaterThan, toSec } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerState,
  PlayerProblem,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import rosDatatypesToMessageDefinition from "@foxglove/studio-base/util/rosDatatypesToMessageDefinition";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";
import { HttpServer } from "@foxglove/xmlrpc";

const log = Logger.getLogger(__filename);
const rosLog = Logger.getLogger("ROS1");

const CAPABILITIES = [
  PlayerCapabilities.advertise,
  PlayerCapabilities.getParameters,
  PlayerCapabilities.setParameters,
];

enum Problem {
  Connection = "Connection",
  Parameters = "Parameters",
  Graph = "Graph",
  Publish = "Publish",
  Node = "Node",
}

type Ros1PlayerOpts = {
  url: string;
  hostname?: string;
  metricsCollector: PlayerMetricsCollectorInterface;
  sourceId: string;
};

// Connects to `rosmaster` instance using `@foxglove/ros1`
export default class Ros1Player implements Player {
  private _url: string; // rosmaster URL.
  private _hostname?: string; // ROS_HOSTNAME
  private _rosNode?: RosNode; // Our ROS node when we're connected.
  private _id: string = uuidv4(); // Unique ID for this player.
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  private _closed: boolean = false; // Whether the player has been completely closed using close().
  private _providerTopics?: Topic[]; // Topics as advertised by rosmaster.
  private _providerTopicsStats = new Map<string, TopicStats>(); // topic names to topic statistics.
  private _providerDatatypes: RosDatatypes = new Map(); // All ROS message definitions received from subscriptions and set by publishers.
  private _publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  private _subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  private _services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  private _parameters = new Map<string, ParameterValue>(); // rosparams
  private _start?: Time; // The time at which we started playing.
  private _clockTime?: Time; // The most recent published `/clock` time, if available
  private _requestedPublishers: AdvertiseOptions[] = []; // Requested publishers by setPublishers()
  private _requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  private _requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics().
  private _hasReceivedMessage = false;
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _presence: PlayerPresence = PlayerPresence.INITIALIZING;
  private _problems = new PlayerProblemManager();
  private _emitTimer?: ReturnType<typeof setTimeout>;
  private readonly _sourceId: string;

  public constructor({ url, hostname, metricsCollector, sourceId }: Ros1PlayerOpts) {
    log.info(`initializing Ros1Player (url=${url}, hostname=${hostname})`);
    this._metricsCollector = metricsCollector;
    this._url = url;
    this._hostname = hostname;
    this._start = this._getCurrentTime();
    this._metricsCollector.playerConstructed();
    this._sourceId = sourceId;
    void this._open();
  }

  private _open = async (): Promise<void> => {
    const os = OsContextSingleton;
    if (this._closed || os == undefined) {
      return;
    }
    this._presence = PlayerPresence.INITIALIZING;

    const hostname =
      this._hostname ??
      RosNode.GetRosHostname(os.getEnvVar, os.getHostname, os.getNetworkInterfaces);

    const net = await Sockets.Create();
    const httpServer = await net.createHttpServer();
    const tcpSocketCreate = async (options: { host: string; port: number }): Promise<TcpSocket> => {
      return await net.createSocket(options.host, options.port);
    };
    const tcpServer = await net.createServer();

    // Mirror the ros_comm c++ library behavior when setting up the tcp server listener.
    // ros_comm listens on all interfaces unless the hostname is explicity set to 'localhost'
    // https://github.com/ros/ros_comm/blob/noetic-devel/clients/roscpp/src/libros/transport/transport_tcp.cpp#L393-L395
    // https://github.com/ros/ros_comm/blob/f5fa3a168760d62e9693f10dcb9adfffc6132d22/clients/roscpp/src/libros/transport/transport.cpp#L67-L72
    let listenHostname = undefined;
    if (hostname === "localhost") {
      listenHostname = "localhost";
    }
    await tcpServer.listen(undefined, listenHostname, 10);

    if (this._rosNode == undefined) {
      const rosNode = new RosNode({
        name: `/foxglovestudio_${os.pid}`,
        hostname,
        pid: os.pid,
        rosMasterUri: this._url,
        httpServer: httpServer as unknown as HttpServer,
        tcpSocketCreate,
        tcpServer,
        log: rosLog,
      });
      this._rosNode = rosNode;

      rosNode.on("paramUpdate", ({ key, value, prevValue, callerId }) => {
        log.debug("paramUpdate", key, value, prevValue, callerId);
        this._parameters = new Map(rosNode.parameters);
      });
      rosNode.on("error", (error) => {
        this._addProblem(Problem.Node, {
          severity: "warn",
          message: "ROS node error",
          tip: `Connectivity will be automatically re-established`,
          error,
        });
      });
    }

    await this._rosNode.start();

    // Process any advertise requests made before our node was ready.
    this.setPublishers(this._requestedPublishers);

    // Request topics *after* setting publishers in case we want to subscribe
    // to topics we are publishing.
    await this._requestTopics();

    this._presence = PlayerPresence.PRESENT;
  };

  private _addProblem(
    id: string,
    problem: PlayerProblem,
    { skipEmit = false }: { skipEmit?: boolean } = {},
  ): void {
    this._problems.addProblem(id, problem);
    if (!skipEmit) {
      this._emitState();
    }
  }

  private _clearProblem(id: string, { skipEmit = false }: { skipEmit?: boolean } = {}): void {
    if (this._problems.removeProblem(id)) {
      if (!skipEmit) {
        this._emitState();
      }
    }
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

  private _requestTopics = async (): Promise<void> => {
    if (this._requestTopicsTimeout) {
      clearTimeout(this._requestTopicsTimeout);
    }
    const rosNode = this._rosNode;
    if (!rosNode || this._closed) {
      return;
    }

    try {
      const topicArrays = await rosNode.getPublishedTopics();
      const topics: Topic[] = topicArrays.map(([name, schemaName]) => ({ name, schemaName }));
      // Sort them for easy comparison
      const sortedTopics = sortBy(topics, "name");

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
      }

      // Try subscribing again, since we might now be able to subscribe to some new topics.
      this.setSubscriptions(this._requestedSubscriptions);

      // Subscribe to all parameters
      try {
        const params = await rosNode.subscribeAllParams();
        if (!isEqual(params, this._parameters)) {
          this._parameters = new Map();
          params.forEach((value, key) => this._parameters.set(key, value));
        }
        this._clearProblem(Problem.Parameters, { skipEmit: true });
      } catch (error) {
        this._addProblem(
          Problem.Parameters,
          {
            severity: "warn",
            message: "ROS parameter fetch failed",
            tip: `Ensure that roscore is running and accessible at: ${this._url}`,
            error,
          },
          { skipEmit: true },
        );
      }

      // Fetch the full graph topology
      await this._updateConnectionGraph(rosNode);

      this._clearProblem(Problem.Connection, { skipEmit: true });
      this._presence = PlayerPresence.PRESENT;
      this._emitState();
    } catch (error) {
      this._presence = PlayerPresence.INITIALIZING;
      this._addProblem(
        Problem.Connection,
        {
          severity: "error",
          message: "ROS connection failed",
          tip: `Ensure that roscore is running and accessible at: ${this._url}`,
          error,
        },
        { skipEmit: false },
      );
    } finally {
      // Regardless of what happens, request topics again in a little bit.
      this._requestTopicsTimeout = setTimeout(this._requestTopics, 3000);
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
        name: this._url,
        presence: this._presence,
        progress: {},
        capabilities: CAPABILITIES,
        profile: "ros1",
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
      name: this._url,
      presence: this._presence,
      progress: {},
      capabilities: CAPABILITIES,
      profile: "ros1",
      playerId: this._id,
      problems: this._problems.problems(),
      urlState: {
        sourceId: this._sourceId,
        parameters: { url: this._url },
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
        services: this._services,
        parameters: this._parameters,
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
      this._rosNode.shutdown();
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

    // Subscribe to additional topics used by Ros1Player itself
    this._addInternalSubscriptions(subscriptions);

    // See what topics we actually can subscribe to.
    const availableTopicsByTopicName = getTopicsByTopicName(this._providerTopics ?? []);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);

    // Subscribe to all topics that we aren't subscribed to yet.
    for (const topicName of topicNames) {
      const availTopic = availableTopicsByTopicName[topicName];
      if (!availTopic || this._rosNode.subscriptions.has(topicName)) {
        continue;
      }

      const { schemaName: datatype } = availTopic;
      const subscription = this._rosNode.subscribe({ topic: topicName, dataType: datatype });

      subscription.on("header", (_header, msgdef, _reader) => {
        // We have to create a new object instead of just updating _providerDatatypes to support
        // shallow memo downstream.
        const newDatatypes = this._getRosDatatypes(datatype, msgdef);
        this._providerDatatypes = new Map([...this._providerDatatypes, ...newDatatypes]);
      });
      subscription.on("message", (message, data, _pub) => {
        this._handleMessage(topicName, message, data.byteLength, datatype, true);
        // Clear any existing subscription problems for this topic if we're receiving messages again.
        this._clearProblem(`subscribe:${topicName}`, { skipEmit: true });
      });
      subscription.on("error", (error) => {
        this._addProblem(`subscribe:${topicName}`, {
          severity: "warn",
          message: `Topic subscription error for "${topicName}"`,
          tip: `The subscription to "${topicName}" will be automatically re-established`,
          error,
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
    message: unknown,
    sizeInBytes: number,
    datatype: string,
    // This is a hot path so we avoid extra object allocation from a parameters struct
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    external: boolean,
  ): void => {
    if (this._providerTopics == undefined) {
      return;
    }

    const receiveTime = this._getCurrentTime();

    if (external && !this._hasReceivedMessage) {
      this._hasReceivedMessage = true;
      this._metricsCollector.recordTimeToFirstMsgs();
    }

    const msg: MessageEvent<unknown> = {
      topic,
      receiveTime,
      message,
      sizeInBytes,
      schemaName: datatype,
    };
    this._parsedMessages.push(msg);
    this._handleInternalMessage(msg);

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

  public setPublishers(publishers: AdvertiseOptions[]): void {
    this._requestedPublishers = publishers;

    if (!this._rosNode || this._closed) {
      return;
    }

    const validPublishers = publishers.filter(({ topic }) => topic.length > 0 && topic !== "/");
    const topics = new Set<string>(validPublishers.map(({ topic }) => topic));

    // Clear all problems related to publishing
    this._clearPublishProblems({ skipEmit: true });

    // Unadvertise any topics that were previously published and no longer appear in the list
    for (const topic of this._rosNode.publications.keys()) {
      if (!topics.has(topic)) {
        this._rosNode.unadvertise(topic);
      }
    }

    // Unadvertise any topics where the dataType changed
    for (const { topic, datatype } of validPublishers) {
      const existingPub = this._rosNode.publications.get(topic);
      if (existingPub != undefined && existingPub.dataType !== datatype) {
        this._rosNode.unadvertise(topic);
      }
    }

    // Advertise new topics
    for (const advertiseOptions of validPublishers) {
      const { topic, datatype: dataType, options } = advertiseOptions;

      if (this._rosNode.publications.has(topic)) {
        continue;
      }

      const msgdefProblemId = `msgdef:${topic}`;
      const advertiseProblemId = `advertise:${topic}`;

      // Try to retrieve the ROS message definition for this topic
      let msgdef: RosMsgDefinition[];
      try {
        const datatypes = options?.["datatypes"] as RosDatatypes | undefined;
        if (!datatypes || !(datatypes instanceof Map)) {
          throw new Error("The datatypes option is required for publishing");
        }
        msgdef = rosDatatypesToMessageDefinition(datatypes, dataType);
      } catch (error) {
        log.debug(error);
        this._addProblem(msgdefProblemId, {
          severity: "warn",
          message: `Unknown message definition for "${topic}"`,
          tip: `Try subscribing to the topic "${topic}" before publishing to it`,
        });
        continue;
      }

      // Advertise this topic to ROS as being published by us
      this._rosNode.advertise({ topic, dataType, messageDefinition: msgdef }).catch((error) =>
        this._addProblem(advertiseProblemId, {
          severity: "error",
          message: `Failed to advertise "${topic}"`,
          error,
        }),
      );
    }

    this._emitState();
  }

  public setParameter(key: string, value: ParameterValue): void {
    log.debug(`Ros1Player.setParameter(key=${key}, value=${value})`);
    // seems to be a TypeScript issue - the ParameterValue type is treated as `any`
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    void this._rosNode?.setParameter(key, value);
  }

  public publish({ topic, msg }: PublishPayload): void {
    const problemId = `publish:${topic}`;

    if (this._rosNode != undefined) {
      if (this._rosNode.isAdvertising(topic)) {
        this._rosNode
          .publish(topic, msg)
          .then(() => this._clearProblem(problemId))
          .catch((error) =>
            this._addProblem(problemId, {
              severity: "error",
              message: `Publishing to ${topic} failed`,
              error,
            }),
          );
      } else {
        this._addProblem(problemId, {
          severity: "warn",
          message: `Unable to publish to "${topic}"`,
          tip: `ROS1 may be disconnected. Please try again in a moment`,
        });
      }
    }
  }

  public async callService(): Promise<unknown> {
    throw new Error("Service calls are not supported by this data source");
  }

  // Bunch of unsupported stuff. Just don't do anything for these.
  public setGlobalVariables(): void {
    // no-op
  }

  private _getRosDatatypes = (
    datatype: string,
    messageDefinition: RosMsgDefinition[],
  ): RosDatatypes => {
    const typesByName: RosDatatypes = new Map();
    for (const def of messageDefinition) {
      // The first definition usually doesn't have an explicit name so we use the datatype
      if (def.name == undefined) {
        typesByName.set(datatype, def);
      } else {
        typesByName.set(def.name, def);
      }
    }
    return typesByName;
  };

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

  private async _updateConnectionGraph(rosNode: RosNode): Promise<void> {
    try {
      const graph = await rosNode.getSystemState();
      if (
        !isEqual(this._publishedTopics, graph.publishers) ||
        !isEqual(this._subscribedTopics, graph.subscribers) ||
        !isEqual(this._services, graph.services)
      ) {
        this._publishedTopics = graph.publishers;
        this._subscribedTopics = graph.subscribers;
        this._services = graph.services;
      }
      this._clearProblem(Problem.Graph, { skipEmit: true });
    } catch (error) {
      this._addProblem(
        Problem.Graph,
        {
          severity: "warn",
          message: "Unable to update connection graph",
          tip: `The connection graph contains information about publishers and subscribers. A
stale graph may result in missing topics you expect. Ensure that roscore is reachable at ${this._url}.`,
          error,
        },
        { skipEmit: true },
      );
      this._publishedTopics = new Map();
      this._subscribedTopics = new Map();
      this._services = new Map();
    }
  }

  private _getCurrentTime(): Time {
    return this._clockTime ?? fromMillis(Date.now());
  }
}
