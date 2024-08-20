// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable @typescript-eslint/no-floating-promises */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual, sortBy, keyBy } from "lodash";
import mqtt, {
  IClientOptions,
  IClientPublishOptions,
  IClientSubscribeOptions,
  MqttClient,
} from "mqtt";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@lichtblick/den/async";
import Log from "@lichtblick/log";
import { Time, fromMillis, isGreaterThan, toSec } from "@foxglove/rostime";
import { ParameterValue } from "@lichtblick/suite";
import PlayerProblemManager from "@lichtblick/suite-base/players/PlayerProblemManager";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  PlayerPresence,
  PlayerMetricsCollectorInterface,
  TopicStats,
  TopicWithSchemaName,
  PlayerProblem,
} from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

const log = Log.getLogger(__dirname);

enum Problem {
  Connection = "Connection",
  Parameters = "Parameters",
  Graph = "Graph",
  Publish = "Publish",
  Node = "Node",
}
type MQRES = {
  meta: string;
  data: MQDATA[];
};
type MQDATA = {
  topic: string;
  node: string;
};

type MQTTPlayerOpts = {
  url: string;
  sourceId: string;
  metricsCollector: PlayerMetricsCollectorInterface;
};

const CAPABILITIES = [
  PlayerCapabilities.advertise,
  PlayerCapabilities.getParameters,
  PlayerCapabilities.setParameters,
];

export default class MQTTPlayer implements Player {
  #url: string; // rosmaster URL.
  #mqttClient?: MqttClient;
  readonly #sourceId: string;
  #id: string = uuidv4(); // Unique ID for this player.
  #listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  #closed: boolean = false; // Whether the player has been completely closed using close().
  #providerTopics?: TopicWithSchemaName[]; // Topics as advertised by rosmaster.
  #providerTopicsStats = new Map<string, TopicStats>(); // topic names to topic statistics.
  #providerDatatypes: RosDatatypes = new Map(); // All ROS message definitions received from subscriptions and set by publishers.
  #publishedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of publisher IDs publishing each topic.
  #subscribedTopics = new Map<string, Set<string>>(); // A map of topic names to the set of subscriber IDs subscribed to each topic.
  #services = new Map<string, Set<string>>(); // A map of service names to service provider IDs that provide each service.
  #parameters = new Map<string, ParameterValue>(); // rosparams
  #start?: Time; // The time at which we started playing.
  #clockTime?: Time; // The most recent published `/clock` time, if available
  // #requestedPublishers: AdvertiseOptions[] = []; // Requested publishers by setPublishers()
  #requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  #parsedMessages: MessageEvent[] = []; // Queue of messages that we'll send in next _emitState() call.
  // #requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics().
  #hasReceivedMessage = false;
  #metricsCollector: PlayerMetricsCollectorInterface;
  #presence: PlayerPresence = PlayerPresence.INITIALIZING;
  #problems = new PlayerProblemManager();
  #emitTimer?: ReturnType<typeof setTimeout>;

  public constructor({ url, sourceId, metricsCollector }: MQTTPlayerOpts) {
    log.info(`initializing MQTTPlayer (url=${url})`);
    this.#metricsCollector = metricsCollector;
    this.#url = url;
    this.#start = this.#getCurrentTime();
    this.#sourceId = sourceId;
    this.#metricsCollector.playerConstructed();
    void this.#open();
  }
  #open = async (): Promise<void> => {
    const clientId = "studio" + this.#id;
    const mqoptions: IClientOptions = {
      keepalive: 30,
      protocolId: "MQTT",
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      rejectUnauthorized: false,
      clientId,
      // username,
      // password,
    };
    this.#presence = PlayerPresence.INITIALIZING;

    const connectMqtt = async (): Promise<void> => {
      if (this.#mqttClient) {
        this.#mqttClient.end();
      }
      try {
        this.#mqttClient = mqtt.connect(this.#url + "/mqtt", mqoptions);

        this.#mqttClient.on("connect", () => {
          this.#presence = PlayerPresence.PRESENT;
          this.#mqttClient!.subscribe("#");
          this.#fetchTopic();
          this.#emitState();
        });

        this.#mqttClient.on("close", () => {
          this.#presence = PlayerPresence.INITIALIZING;
          this.#emitState();
        });

        this.#mqttClient.on("error", (error) => {
          // Handle MQTT connection errors
          this.#addProblem(Problem.Connection, {
            severity: "error",
            message: "MQTT connection failed",
            tip: `Ensure that the MQTT broker is running and accessible at: ${this.#url}`,
            error,
          });
          this.#presence = PlayerPresence.INITIALIZING;
          this.#emitState();
        });
      } catch (error) {
        this.#addProblem(Problem.Connection, {
          severity: "error",
          message: "MQTT connection failed",
          tip: `Ensure that the MQTT broker is running and accessible at: ${this.#url}`,
          error,
        });
        this.#presence = PlayerPresence.INITIALIZING;
        this.#emitState();
      }

      await new Promise<void>((resolve) => {
        this.#mqttClient!.on("connect", () => {
          resolve();
        });
      });
    };
    this.#emitState();
    await connectMqtt();

    // eslint-disable-next-line no-restricted-syntax
    console.log("open");
  };
  #fetchTopic = async () => {
    try {
      const apiUrl = "http://10.51.128.128:18083/api/v4/routes";
      const headers = new Headers({
        Authorization: "Basic YWRtaW46cHVibGlj" + "",
        "Content-Type": "application/json",
      });

      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const result: MQRES = await response.json();
      const topics: TopicWithSchemaName[] = [];
      for (const route of result.data) {
        const topicR: Topic = {
          name: route.topic,
          schemaName: "std_msgs/String",
          aliasedFromName: "MQTT Message",
        };
        const schemaName: string = "std_msgs/String";

        topics.push({ ...topicR, schemaName });
      }
      const sortedTopics = sortBy(topics, "name");

      if (this.#topicsChanged(sortedTopics)) {
        // Remove stats entries for removed topics
        const topicsSet = new Set<string>(topics.map((topic) => topic.name));
        for (const topic of this.#providerTopicsStats.keys()) {
          if (!topicsSet.has(topic)) {
            this.#providerTopicsStats.delete(topic);
          }
        }
        this.setSubscriptions(this.#requestedSubscriptions);

        this.#providerTopics = sortedTopics;
      }
      this.#emitState();
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    this.#emitState();
  }
  // 订阅 MQTT 主题以接收播放器状态更新

  public close(): void {
    this.#closed = true;
    this.#presence = PlayerPresence.RECONNECTING;
    if (this.#mqttClient != undefined) {
      this.#mqttClient.end();
    }
  }
  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.#requestedSubscriptions = subscriptions;
    this.#addInternalSubscriptions(subscriptions);
    // 添加 MQTT 订阅逻辑，订阅指定的 MQTT 主题
    const availableTopicsByTopicName = keyBy(this.#providerTopics ?? [], ({ name }) => name);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);
    for (const topicName of topicNames) {
      const mqttSubscribeOptions: IClientSubscribeOptions = {
        qos: 0, // 适当的 QoS 值
      };
      if (this.#mqttClient != undefined) {
        this.#mqttClient.subscribe(topicName, mqttSubscribeOptions);
        this.#mqttClient.on("message", (topic, message) => {
          this.#fetchTopic();
          this.#handleMessage(
            topic,
            JSON.parse(String(message)),
            message.byteLength,
            "std_msgs/String",
            true,
          );
        });
      }
    }
  }
  #handleInternalMessage(msg: MessageEvent): void {
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
  #handleMessage = (
    topic: string,
    message: unknown,
    sizeInBytes: number,
    schemaName: string,
    // This is a hot path so we avoid extra object allocation from a parameters struct
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    external: boolean,
  ): void => {
    if (this.#providerTopics == undefined) {
      return;
    }

    const receiveTime = this.#getCurrentTime();

    if (external && !this.#hasReceivedMessage) {
      this.#hasReceivedMessage = true;
      // this.#metricsCollector.recordTimeToFirstMsgs();
    }

    const msg: MessageEvent = {
      topic,
      receiveTime,
      message,
      sizeInBytes,
      schemaName,
    };
    this.#parsedMessages.push(msg);
    this.#handleInternalMessage(msg);

    // Update the message count for this topic
    let stats = this.#providerTopicsStats.get(topic);

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

    this.#emitState();
  };
  public setPublishers(publishers: AdvertiseOptions[]): void {
    // 添加 MQTT 广告逻辑，将自身作为 MQTT 主题的发布者
    for (const publisher of publishers) {
      const { topic, options } = publisher;

      const mqttPublishOptions: IClientPublishOptions = {
        qos: 0, // 适当的 QoS 值
      };
      if (this.#mqttClient != undefined) {
        if (topic && options != undefined) {
          const data = JSON.stringify(options, undefined);
          this.#mqttClient.publish(topic, String(data), mqttPublishOptions);
        }
      }
    }
  }
  public setParameter(key: string, value: ParameterValue): void {
    // 发布参数更新到 MQTT 主题
    const parameterUpdateTopic = `parameterUpdate/${key}`;
    if (this.#mqttClient != undefined) {
      this.#mqttClient.publish(parameterUpdateTopic, String(value));
    }
  }

  public publish(request: PublishPayload): void {
    // 发布消息到 MQTT 主题
    const { topic, msg } = request;
    if (this.#mqttClient != undefined) {
      this.#mqttClient.publish(topic, String(JSON.stringify(msg)));
    }
  }
  #addInternalSubscriptions(subscriptions: SubscribePayload[]): void {
    // Always subscribe to /clock if available
    if (subscriptions.find((sub) => sub.topic === "/clock") == undefined) {
      subscriptions.unshift({
        topic: "/clock",
      });
    }
  }

  public async callService(service: string, request: unknown): Promise<unknown> {
    // 实现 MQTT 服务调用逻辑
    // 发布请求到服务主题，等待响应
    const serviceRequestTopic = `serviceRequest/${service}`;
    if (this.#mqttClient != undefined) {
      this.#mqttClient.publish(serviceRequestTopic, String(request));
    }
    // 等待并返回响应
    return await new Promise<unknown>((resolve) => {
      // 添加逻辑以在收到响应时调用 resolve
      // ...
      // eslint-disable-next-line no-restricted-syntax
      console.log(resolve);
    });
  }
  public setGlobalVariables(): void {
    // no-op
  }
  #addProblem(
    id: string,
    problem: PlayerProblem,
    { skipEmit = false }: { skipEmit?: boolean } = {},
  ): void {
    this.#problems.addProblem(id, problem);
    if (!skipEmit) {
      this.#emitState();
    }
  }

  #topicsChanged = (newTopics: Topic[]): boolean => {
    if (!this.#providerTopics || newTopics.length !== this.#providerTopics.length) {
      return true;
    }
    return !isEqual(this.#providerTopics, newTopics);
  };
  #getCurrentTime(): Time {
    return this.#clockTime ?? fromMillis(Date.now());
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  #emitState = debouncePromise(() => {
    if (!this.#listener || this.#closed) {
      return Promise.resolve();
    }

    const providerTopics = this.#providerTopics;
    const start = this.#start;
    if (!providerTopics || !start) {
      return this.#listener({
        name: this.#url,
        presence: this.#presence,
        progress: {},
        capabilities: CAPABILITIES,
        profile: "mqtt",
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
      name: this.#url,
      presence: this.#presence,
      progress: {},
      capabilities: CAPABILITIES,
      profile: "mqtt",
      playerId: this.#id,
      problems: this.#problems.problems(),
      urlState: {
        sourceId: this.#sourceId,
        parameters: { url: this.#url },
      },

      activeData: {
        messages,
        totalBytesReceived: 0,
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
        services: this.#services,
        parameters: this.#parameters,
      },
    });
  });
}
