// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual, sortBy } from "lodash";
import { RosMsgDefinition, Time } from "rosbag";
import { v4 as uuidv4 } from "uuid";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import {
  AdvertisePayload,
  MessageEvent,
  ParameterValue,
  Player,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import debouncePromise from "@foxglove-studio/app/util/debouncePromise";
import { getTopicsByTopicName } from "@foxglove-studio/app/util/selectors";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import {
  addTimes,
  fromMillis,
  subtractTimes,
  TimestampMethod,
  toSec,
} from "@foxglove-studio/app/util/time";
import { Sockets } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";
import { RosNode, TcpSocket } from "@foxglove/ros1";
import { HttpServer } from "@foxglove/xmlrpc";

const log = Logger.getLogger(__filename);
const rosLog = Logger.getLogger("ROS1");

const CAPABILITIES = [PlayerCapabilities.getParameters, PlayerCapabilities.setParameters];
const NO_WARNINGS = Object.freeze({});

type Ros1PlayerOpts = {
  url: string;
  hostname?: string;
  metricsCollector: PlayerMetricsCollectorInterface;
};

// Connects to `rosmaster` instance using `@foxglove/ros1`. Currently doesn't support seeking or
// showing simulated time, so current time from Date.now() is always used instead.
export default class Ros1Player implements Player {
  private _url: string; // rosmaster URL.
  private _hostname?: string; // ROS_HOSTNAME
  private _rosNode?: RosNode; // Our ROS node when we're connected.
  private _id: string = uuidv4(); // Unique ID for this player.
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  private _closed: boolean = false; // Whether the player has been completely closed using close().
  private _providerTopics?: Topic[]; // Topics as advertised by rosmaster.
  private _providerDatatypes: RosDatatypes = {}; // All ROS message definitions received from subscriptions.
  private _publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  private _subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  private _services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  private _parameters = new Map<string, ParameterValue>(); // rosparams
  private _start?: Time; // The time at which we started playing.
  private _clockTime?: Time; // The most recent published `/clock` time, if available
  private _clockReceived: Time = { sec: 0, nsec: 0 }; // The local time when `_clockTime` was last received
  private _requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  private _parsedMessages: MessageEvent<unknown>[] = []; // Queue of messages that we'll send in next _emitState() call.
  private _messageOrder: TimestampMethod = "receiveTime";
  private _requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics().
  private _hasReceivedMessage = false;
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _sentTopicsErrorNotification = false;
  private _sentNodesErrorNotification = false;

  constructor({ url, hostname, metricsCollector }: Ros1PlayerOpts) {
    log.info(`initializing Ros1Player (url=${url})`);
    this._metricsCollector = metricsCollector;
    this._url = url;
    this._hostname = hostname;
    this._start = fromMillis(Date.now());
    this._metricsCollector.playerConstructed();
    this._open();
  }

  private _open = async (): Promise<void> => {
    const os = OsContextSingleton;
    if (this._closed || os == undefined) {
      return;
    }

    const hostname =
      this._hostname ??
      RosNode.GetRosHostname(os.getEnvVar, os.getHostname, os.getNetworkInterfaces);

    const net = await Sockets.Create();
    const httpServer = await net.createHttpServer();
    const tcpSocketCreate = (options: { host: string; port: number }): Promise<TcpSocket> => {
      return net.createSocket(options.host, options.port);
    };

    if (this._rosNode == undefined) {
      const rosNode = new RosNode({
        name: "/foxglovestudio",
        hostname,
        pid: os.pid,
        rosMasterUri: this._url,
        httpServer: (httpServer as unknown) as HttpServer,
        tcpSocketCreate,
        log: rosLog,
      });
      this._rosNode = rosNode;

      rosNode.on("paramUpdate", ({ key, value, prevValue, callerId }) => {
        log.debug("paramUpdate", key, value, prevValue, callerId);
        this._parameters = new Map(rosNode.parameters);
      });
    }

    await this._rosNode.start();
    this._requestTopics();
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
      const topics = topicArrays.map(([name, datatype]) => ({ name, datatype }));
      // Sort them for easy comparison. If nothing has changed here, bail out
      const sortedTopics: Topic[] = sortBy(topics, "name");
      if (isEqual(sortedTopics, this._providerTopics)) {
        return;
      }

      if (this._providerTopics == undefined) {
        this._metricsCollector.initialized();
      }

      this._providerTopics = sortedTopics;

      // Try subscribing again, since we might now be able to subscribe to some new topics.
      this.setSubscriptions(this._requestedSubscriptions);

      // Subscribe to all parameters
      const params = await rosNode.subscribeAllParams();
      this._parameters = new Map();
      params.forEach((value, key) => this._parameters.set(key, value));

      // Fetch the full graph topology
      try {
        const graph = await rosNode.getSystemState();
        this._publishedTopics = graph.publishers;
        this._subscribedTopics = graph.subscribers;
        this._services = graph.services;
      } catch (error) {
        if (!this._sentNodesErrorNotification) {
          this._sentNodesErrorNotification = true;
          sendNotification("Failed to fetch system state from ROS", error, "user", "warn");
        }
        this._publishedTopics = new Map();
        this._subscribedTopics = new Map();
        this._services = new Map();
      }

      this._emitState();
    } catch (error) {
      if (!this._sentTopicsErrorNotification) {
        this._sentTopicsErrorNotification = true;
        sendNotification("Error connecting to ROS", error, "user", "error");
      }
    } finally {
      // Regardless of what happens, request topics again in a little bit.
      this._requestTopicsTimeout = setTimeout(this._requestTopics, 3000);
    }
  };

  private _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const providerTopics = this._providerTopics;
    const start = this._start;
    if (!providerTopics || !start) {
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
        totalBytesReceived: this._rosNode?.receivedBytes() ?? 0,
        messageOrder: this._messageOrder,
        startTime: start,
        endTime: currentTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        // We don't support seeking, so we need to set this to any fixed value. Just avoid 0 so
        // that we don't accidentally hit falsy checks.
        lastSeekTime: 1,
        topics: providerTopics,
        datatypes: this._providerDatatypes,
        publishedTopics: this._publishedTopics,
        subscribedTopics: this._subscribedTopics,
        services: this._services,
        parameters: this._parameters,
        parsedMessageDefinitionsByTopic: {},
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
    if (this._rosNode) {
      this._rosNode.shutdown();
    }
    this._metricsCollector.close();
    this._hasReceivedMessage = false;
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
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

      const { datatype } = availTopic;
      const subscription = this._rosNode.subscribe({ topic: topicName, type: datatype });
      subscription.on("header", (_header, msgdef, _reader) => {
        // We have to create a new object instead of just updating _providerDatatypes because it is
        // later fed into a memoize() call
        const typesByName: RosDatatypes = {};
        Object.assign(typesByName, this._providerDatatypes);
        Object.assign(typesByName, this._getRosDatatypes(datatype, msgdef));
        this._providerDatatypes = typesByName;
      });
      subscription.on("message", (message, _data, _publisher) => {
        if (this._providerTopics == undefined) {
          return;
        }

        const receiveTime = fromMillis(Date.now());

        if (!this._hasReceivedMessage) {
          this._hasReceivedMessage = true;
          this._metricsCollector.recordTimeToFirstMsgs();
        }

        const msg: MessageEvent<unknown> = {
          topic: topicName,
          receiveTime,
          message: message,
        };
        this._parsedMessages.push(msg);
        this._handleInternalMessage(msg);

        this._emitState();
      });
    }

    // Unsubscribe from topics that we are subscribed to but shouldn't be.
    for (const topicName of this._rosNode.subscriptions.keys()) {
      if (!topicNames.includes(topicName)) {
        {
          this._rosNode.unsubscribe(topicName);
        }
      }
    }
  }

  setPublishers(publishers: AdvertisePayload[]): void {
    // TODO: Publishing
    publishers = publishers.filter((p) => p.topic.length > 0);
    if (publishers.length > 0) {
      const topics = publishers.map((p) => p.topic).join(", ");
      sendNotification(
        "Publishing not supported",
        `Cannot publish to "${topics}", ROS publishing is not supported yet`,
        "user",
        "error",
      );
    }
  }

  setParameter(key: string, value: ParameterValue): void {
    log.debug(`Ros1Player.setParameter(key=${key}, value=${value})`);
    this._rosNode?.setParameter(key, value);
  }

  publish({ topic, msg }: PublishPayload): void {
    const publication = this._rosNode?.publications.get(topic);
    if (publication == undefined) {
      sendNotification(
        "Invalid publish call",
        `Tried to publish on a topic that is not registered as a publisher: ${topic}`,
        "app",
        "error",
      );
      return;
    }
    // TODO: Publishing
    <void>msg;
    // publication.publish(msg);
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

  private _getRosDatatypes = (
    datatype: string,
    messageDefinition: RosMsgDefinition[],
  ): RosDatatypes => {
    const typesByName: RosDatatypes = {};
    messageDefinition.forEach(({ name, definitions }, index) => {
      // The first definition usually doesn't have an explicit name,
      // so we get the name from the connection.
      if (index === 0) {
        typesByName[datatype] = { fields: definitions };
      } else if (name != undefined) {
        typesByName[name] = { fields: definitions };
      }
    });
    return typesByName;
  };

  private _addInternalSubscriptions(subscriptions: SubscribePayload[]): void {
    // Always subscribe to /clock if available
    if (subscriptions.find((sub) => sub.topic === "/clock") === undefined) {
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
}
