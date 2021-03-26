// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual, sortBy, partition } from "lodash";
import { RosMsgDefinition, Time } from "rosbag";
import { v4 as uuidv4 } from "uuid";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import {
  AdvertisePayload,
  BobjectMessage,
  Message,
  Player,
  PlayerCapabilities,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { wrapJsObject } from "@foxglove-studio/app/util/binaryObjects";
import debouncePromise from "@foxglove-studio/app/util/debouncePromise";
import { getTopicsByTopicName } from "@foxglove-studio/app/util/selectors";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import { fromMillis, TimestampMethod } from "@foxglove-studio/app/util/time";
import { Sockets } from "@foxglove/electron-socket/renderer";
import { RosNode, TcpSocket } from "@foxglove/ros1";
import { HttpServer } from "@foxglove/xmlrpc/src";

const capabilities = [PlayerCapabilities.advertise];
const NO_WARNINGS = Object.freeze({});

// Connects to `rosmaster` instance using `@foxglove/ros1`. Currently doesn't support seeking or
// showing simulated time, so current time from Date.now() is always used instead.
export default class Ros1Player implements Player {
  #url: string; // rosmaster URL.
  #rosNode?: RosNode; // Our ROS node when we're connected.
  #id: string = uuidv4(); // Unique ID for this player.
  #listener?: (arg0: PlayerState) => Promise<void>; // Listener for #emitState().
  #closed: boolean = false; // Whether the player has been completely closed using close().
  #providerTopics?: Topic[]; // Topics as advertised by rosmaster.
  #providerDatatypes: RosDatatypes = {}; // All ROS message definitions received from subscriptions.
  #start?: Time; // The time at which we started playing.
  #requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  #parsedMessages: Message[] = []; // Queue of messages that we'll send in next #emitState() call.
  #bobjects: BobjectMessage[] = []; // Queue of bobjects that we'll send in next #emitState() call.
  #messageOrder: TimestampMethod = "receiveTime";
  #requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for #requestTopics().
  #bobjectTopics: Set<string> = new Set();
  #parsedTopics: Set<string> = new Set();

  constructor(url: string) {
    this.#url = url;
    this.#start = fromMillis(Date.now());
    this.#open();
  }

  #open = async (): Promise<void> => {
    const os = OsContextSingleton;
    if (this.#closed || os == undefined) {
      return;
    }

    const net = await Sockets.Create();
    const httpServer = await net.createHttpServer();
    const tcpSocketCreate = (options: { host: string; port: number }): Promise<TcpSocket> => {
      return net.createSocket(options.host, options.port);
    };

    if (this.#rosNode == undefined) {
      this.#rosNode = new RosNode({
        name: "/foxglovestudio",
        hostname: RosNode.GetRosHostname(os.getEnvVar, os.getHostname, os.getNetworkInterfaces),
        pid: os.pid,
        rosMasterUri: this.#url,
        httpServer: (httpServer as unknown) as HttpServer,
        tcpSocketCreate,
      });
    }

    await this.#rosNode.start();
    this.#requestTopics();
  };

  #requestTopics = async (): Promise<void> => {
    if (this.#requestTopicsTimeout) {
      clearTimeout(this.#requestTopicsTimeout);
    }
    const rosNode = this.#rosNode;
    if (!rosNode || this.#closed) {
      return;
    }

    try {
      const topicArrays = await rosNode.getPublishedTopics();
      const topics = topicArrays.map(([name, datatype]) => ({ name, datatype }));
      // Sort them for easy comparison. If nothing has changed here, bail out
      const sortedTopics: Topic[] = sortBy(topics, "name");
      if (isEqual(sortedTopics, this.#providerTopics)) {
        return;
      }

      this.#providerTopics = sortedTopics;

      // Try subscribing again, since we might now be able to subscribe to some new topics.
      this.setSubscriptions(this.#requestedSubscriptions);
      this.#emitState();
    } catch (error) {
      sendNotification("Error in fetching topics and datatypes", error, "app", "error");
    } finally {
      // Regardless of what happens, request topics again in a little bit.
      this.#requestTopicsTimeout = setTimeout(this.#requestTopics, 3000);
    }
  };

  #emitState = debouncePromise(() => {
    if (!this.#listener || this.#closed) {
      return Promise.resolve();
    }

    const providerTopics = this.#providerTopics;
    const start = this.#start;
    if (!providerTopics || !start) {
      return this.#listener({
        presence: PlayerPresence.INITIALIZING,
        progress: {},
        capabilities,
        playerId: this.#id,
        activeData: undefined,
      });
    }

    // Time is always moving forward even if we don't get messages from the server.
    setTimeout(this.#emitState, 100);

    const currentTime = fromMillis(Date.now());
    const messages = this.#parsedMessages;
    this.#parsedMessages = [];
    const bobjects = this.#bobjects;
    this.#bobjects = [];
    return this.#listener({
      presence: PlayerPresence.PRESENT,
      progress: {},
      capabilities,
      playerId: this.#id,

      activeData: {
        messages,
        bobjects,
        totalBytesReceived: this.#rosNode?.receivedBytes() ?? 0,
        messageOrder: this.#messageOrder,
        startTime: start,
        endTime: currentTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        // We don't support seeking, so we need to set this to any fixed value. Just avoid 0 so
        // that we don't accidentally hit falsy checks.
        lastSeekTime: 1,
        topics: providerTopics,
        datatypes: this.#providerDatatypes,
        parsedMessageDefinitionsByTopic: {},
        playerWarnings: NO_WARNINGS,
      },
    });
  });

  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    this.#emitState();
  }

  close(): void {
    this.#closed = true;
    if (this.#rosNode) {
      this.#rosNode.shutdown();
    }
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.#requestedSubscriptions = subscriptions;

    if (!this.#rosNode || this.#closed) {
      return;
    }

    const [bobjectSubscriptions, parsedSubscriptions] = partition(
      subscriptions,
      ({ format }) => format === "bobjects",
    );
    this.#bobjectTopics = new Set(bobjectSubscriptions.map(({ topic }) => topic));
    this.#parsedTopics = new Set(parsedSubscriptions.map(({ topic }) => topic));

    // See what topics we actually can subscribe to.
    const availableTopicsByTopicName = getTopicsByTopicName(this.#providerTopics ?? []);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);

    // Subscribe to all topics that we aren't subscribed to yet.
    for (const topicName of topicNames) {
      const availTopic = availableTopicsByTopicName[topicName];
      if (!availTopic || this.#rosNode.subscriptions.has(topicName)) {
        continue;
      }

      const { datatype } = availTopic;
      const subscription = this.#rosNode.subscribe({ topic: topicName, type: datatype });
      subscription.on("header", (_header, msgdef, _reader) => {
        // We have to create a new object instead of just updating #providerDatatypes because it is
        // later fed into a memoize() call
        const typesByName: RosDatatypes = {};
        Object.assign(typesByName, this.#providerDatatypes);
        Object.assign(typesByName, this.#getRosDatatypes(datatype, msgdef));
        this.#providerDatatypes = typesByName;
      });
      subscription.on("message", (message, _data, _publisher) => {
        if (this.#providerTopics == undefined) {
          return;
        }

        const receiveTime = fromMillis(Date.now());
        if (this.#bobjectTopics.has(topicName)) {
          this.#bobjects.push({
            topic: topicName,
            receiveTime,
            message: wrapJsObject(this.#providerDatatypes, datatype, message),
          });
        }

        if (this.#parsedTopics.has(topicName)) {
          this.#parsedMessages.push({
            topic: topicName,
            receiveTime,
            message: message as never,
          });
        }

        this.#emitState();
      });
    }

    // Unsubscribe from topics that we are subscribed to but shouldn't be.
    for (const topicName of this.#rosNode.subscriptions.keys()) {
      if (!topicNames.includes(topicName)) {
        {
          this.#rosNode.unsubscribe(topicName);
        }
      }
    }
  }

  setPublishers(publishers: AdvertisePayload[]): void {
    // TODO: Publishing
    if (publishers.length > 0) {
      const topics = publishers.map((p) => p.topic).join(", ");
      sendNotification(
        "Publishing not supported",
        `Cannot publish to "${topics}", ROS publishing is not supported yet`,
        "app",
        "error",
      );
    }
  }

  publish({ topic, msg }: PublishPayload): void {
    const publication = this.#rosNode?.publications.get(topic);
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

  #getRosDatatypes = (datatype: string, messageDefinition: RosMsgDefinition[]): RosDatatypes => {
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
}
