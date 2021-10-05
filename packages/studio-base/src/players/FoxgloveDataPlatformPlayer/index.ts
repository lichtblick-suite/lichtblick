// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";
import { MessageReader as ROS2MessageReader } from "@foxglove/rosmsg2-serialization";
import {
  add,
  areEqual,
  clampTime,
  fromMillis,
  fromRFC3339String,
  fromSec,
  isGreaterThan,
  isLessThan,
  subtract,
  Time,
  toRFC3339String,
  toSec,
} from "@foxglove/rostime";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  MessageEvent,
  ParameterValue,
  Player,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerProblem,
  PlayerState,
  Progress,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import debouncePromise from "@foxglove/studio-base/util/debouncePromise";
import signal, { Signal } from "@foxglove/studio-base/util/signal";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import MessageMemoryCache from "./MessageMemoryCache";
import collateMessageStream from "./collateMessageStream";
import streamMessages from "./streamMessages";

const log = Logger.getLogger(__filename);

const CAPABILITIES: string[] = ["playbackControl"];

type FoxgloveDataPlatformPlayerOpts = {
  consoleApi: ConsoleApi;
  params: {
    start: string;
    end: string;
    seek?: string;
    deviceId: string;
  };
  metricsCollector: PlayerMetricsCollectorInterface;
};

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });

export default class FoxgloveDataPlatformPlayer implements Player {
  private readonly _preloadThresholdSecs = 5;
  private readonly _preloadDurationSecs = 15;

  private _id: string = uuidv4(); // Unique ID for this player
  private _name: string;
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState()
  private _totalBytesReceived = 0;
  private _initialized: { preloadedMessages: MessageMemoryCache } | undefined;
  private _closed = false; // Whether the player has been completely closed using close()
  private _isPlaying = false;
  private _speed = 1;
  private _start: Time;
  private _end: Time;
  private _consoleApi: ConsoleApi;
  private _deviceId: string;
  private _currentTime: Time;
  private _lastSeekTime?: number;
  private _topics: Topic[] = [];
  private _datatypes: RosDatatypes = new Map();
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _presence: PlayerPresence = PlayerPresence.INITIALIZING;
  private _currentPreloadTask?: AbortController;
  private _requestedTopics: string[] = [];
  private _progress: Progress = {};
  private _loadedMoreMessages?: Signal<void>;
  private _nextFrame: MessageEvent<unknown>[] = [];

  /**
   * Cached readers for each schema so we don't have to re-parse definitions on each stream request.
   * Although each topic is usually homogeneous, technically it is possible to have different
   * encoding or schema for each topic, so we store all the ones we've seen.
   */
  private _messageReadersByTopic = new Map<
    string,
    { encoding: string; schema: string; reader: ROS2MessageReader | LazyMessageReader }[]
  >();

  // track issues within the player
  private _problems: PlayerProblem[] = [];
  private _problemsById = new Map<string, PlayerProblem>();

  constructor({ params, metricsCollector, consoleApi }: FoxgloveDataPlatformPlayerOpts) {
    log.info(`initializing FoxgloveDataPlatformPlayer ${JSON.stringify(params)}`);
    this._metricsCollector = metricsCollector;
    this._metricsCollector.playerConstructed();
    const start = fromRFC3339String(params.start);
    const end = fromRFC3339String(params.end);
    if (!start || !end) {
      throw new Error(`Invalid start/end time: ${start}, ${end}`);
    }
    this._start = start;
    this._end = end;
    this._currentTime = this._start;
    this._deviceId = params.deviceId;
    this._name = `${this._deviceId}, ${formatTimeRaw(this._start)} to ${formatTimeRaw(this._end)}`;
    this._consoleApi = consoleApi;
    this._open().catch((error) => {
      this._presence = PlayerPresence.ERROR;
      this._addProblem("open-failed", { message: error.message, error, severity: "error" });
    });
  }

  private _open = async (): Promise<void> => {
    if (this._closed) {
      return;
    }
    this._presence = PlayerPresence.INITIALIZING;
    this._emitState();

    const [coverage, rawTopics] = await Promise.all([
      this._consoleApi.coverage({
        deviceId: this._deviceId,
        start: toRFC3339String(this._start),
        end: toRFC3339String(this._end),
      }),
      this._consoleApi.topics({
        deviceId: this._deviceId,
        start: toRFC3339String(this._start),
        end: toRFC3339String(this._end),
        includeSchemas: true,
      }),
    ]);
    if (rawTopics.length === 0 || coverage.length === 0) {
      throw new Error(
        `No data available for ${this._deviceId} between ${formatTimeRaw(
          this._start,
        )} and ${formatTimeRaw(this._end)}.`,
      );
    }

    // Truncate start/end time to coverage range
    const coverageStart = fromRFC3339String(coverage[0]!.start);
    const coverageEnd = fromRFC3339String(coverage[coverage.length - 1]!.end);
    if (!coverageStart || !coverageEnd) {
      throw new Error(
        `Invalid coverage response, start: ${coverage[0]!.start}, end: ${
          coverage[coverage.length - 1]!.end
        }`,
      );
    }
    if (isLessThan(this._start, coverageStart)) {
      log.debug("Reduced start time from", this._start, "to", coverageStart);
      this._start = coverageStart;
      this._currentTime = this._start;
    }
    if (isGreaterThan(this._end, coverageEnd)) {
      log.debug("Reduced end time from", this._end, "to", coverageEnd);
      this._end = coverageEnd;
    }

    const topics: Topic[] = [];
    const datatypes: RosDatatypes = new Map();
    for (const { topic, encoding, schema, schemaName } of rawTopics) {
      if (schema == undefined) {
        throw new Error(`missing requested schema for ${topic}`);
      }
      if (encoding !== "ros1" && encoding !== "ros2") {
        throw new Error(`Unsupported encoding for ${topic}: ${encoding}`);
      }

      topics.push({ name: topic, datatype: schemaName });

      const parsedDefinitions = parseMessageDefinition(schema, { ros2: encoding === "ros2" });
      parsedDefinitions.forEach(({ name, definitions }, index) => {
        // The first definition usually doesn't have an explicit name,
        // so we get the name from the datatype.
        if (index === 0) {
          datatypes.set(schemaName, { name: schemaName, definitions });
        } else if (name != undefined) {
          datatypes.set(name, { name, definitions });
        }
      });

      let readers = this._messageReadersByTopic.get(topic);
      if (!readers) {
        readers = [];
        this._messageReadersByTopic.set(topic, readers);
      }
      for (const reader of readers) {
        if (reader.encoding === encoding && reader.schema === schema) {
          continue;
        }
      }
      switch (encoding) {
        case "ros1":
          readers.push({ encoding, schema, reader: new LazyMessageReader(parsedDefinitions) });
          break;
        case "ros2":
          readers.push({ encoding, schema, reader: new ROS2MessageReader(parsedDefinitions) });
          break;
      }
    }
    this._topics = topics;
    this._datatypes = datatypes;

    this._presence = PlayerPresence.PRESENT;
    this._initialized = {
      preloadedMessages: new MessageMemoryCache({ start: this._start, end: this._end }),
    };
    this._emitState();
    this._startPreloadTaskIfNeeded();
  };

  private _addProblem(
    id: string,
    problem: PlayerProblem,
    { skipEmit = false }: { skipEmit?: boolean } = {},
  ): void {
    this._problemsById.set(id, problem);
    this._problems = Array.from(this._problemsById.values());
    if (!skipEmit) {
      this._emitState();
    }
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  private _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const messages = this._nextFrame;
    if (messages.length > 0) {
      this._nextFrame = [];
    }

    return this._listener({
      name: this._name,
      presence: this._presence,
      progress: this._progress,
      capabilities: CAPABILITIES,
      playerId: this._id,
      problems: this._problems,

      activeData: {
        messages,
        totalBytesReceived: this._totalBytesReceived,
        messageOrder: "receiveTime",
        startTime: this._start ?? ZERO_TIME,
        endTime: this._end ?? ZERO_TIME,
        currentTime: this._currentTime,
        isPlaying: this._isPlaying,
        speed: this._speed,
        lastSeekTime: this._lastSeekTime ?? 0,
        topics: this._topics,
        datatypes: this._datatypes,
        publishedTopics: undefined,
        subscribedTopics: undefined,
        services: undefined,
        parameters: undefined,
        parsedMessageDefinitionsByTopic: {},
      },
    });
  });

  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  close(): void {
    this._closed = true;
    this._metricsCollector.close();
    this._currentPreloadTask?.abort();
    this._currentPreloadTask = undefined;
    this._totalBytesReceived = 0;
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    log.debug("setSubscriptions", subscriptions);
    this._requestedTopics = Array.from(new Set(subscriptions.map(({ topic }) => topic)));
    this._clearPreloadedData();
    this._startPreloadTaskIfNeeded();
    this._emitState();
  }

  private _runPlaybackLoop = debouncePromise(async () => {
    if (!this._initialized) {
      return;
    }
    let lastTickEndTime: number | undefined;
    let lastReadMs: number | undefined;
    mainLoop: while (this._isPlaying) {
      await this._emitState.currentPromise;

      // compute how long of a time range we want to read by taking into account
      // the time since our last read and how fast we're currently playing back
      const msSinceLastTick =
        lastTickEndTime != undefined ? performance.now() - lastTickEndTime : 20;

      // Read at most 300ms worth of messages, otherwise things can get out of control if rendering
      // is very slow. Also, smooth over the range that we request, so that a single slow frame won't
      // cause the next frame to also be unnecessarily slow by increasing the frame size.
      let readMs = Math.min(msSinceLastTick * this._speed, 300);
      if (lastReadMs != undefined) {
        readMs = lastReadMs * 0.9 + readMs * 0.1;
      }
      lastReadMs = readMs;

      const lastSeekTime = this._lastSeekTime;
      const startTime = this._currentTime;
      const endTime = clampTime(add(startTime, fromMillis(readMs)), this._start, this._end);
      this._startPreloadTaskIfNeeded();
      let messages;
      while (
        !(messages = this._initialized.preloadedMessages.getMessages({
          start: startTime,
          end: endTime,
        }))
      ) {
        log.debug("Waiting for more messages");
        // Wait for new messages to be loaded
        await (this._loadedMoreMessages = signal());
        if (this._lastSeekTime !== lastSeekTime) {
          lastTickEndTime = undefined;
          continue mainLoop;
        }
      }
      lastTickEndTime = performance.now();
      this._nextFrame = messages;
      this._currentTime = endTime;
      if (areEqual(this._currentTime, this._end)) {
        this._isPlaying = false;
      }
      this._emitState();
    }
  });

  private _clearPreloadedData() {
    if (this._initialized) {
      this._initialized.preloadedMessages.clear();
      this._progress = {
        fullyLoadedFractionRanges: this._initialized.preloadedMessages.fullyLoadedFractionRanges(),
      };
    }
    this._currentPreloadTask?.abort();
    this._currentPreloadTask = undefined;
  }

  private _startPreloadTaskIfNeeded() {
    if (!this._initialized || this._closed) {
      return;
    }
    if (this._currentPreloadTask) {
      return;
    }
    const preloadedMessages = this._initialized.preloadedMessages;
    const nextRangeToLoad = preloadedMessages.nextRangeToLoad(this._currentTime);
    const shouldPreload =
      this._requestedTopics.length > 0 &&
      nextRangeToLoad != undefined &&
      toSec(subtract(nextRangeToLoad.start, this._currentTime)) < this._preloadThresholdSecs;
    if (!shouldPreload) {
      return;
    }

    const startTime = nextRangeToLoad.start;
    const endTime = clampTime(
      add(startTime, fromSec(this._preloadDurationSecs)),
      this._start,
      nextRangeToLoad.end,
    );
    if (areEqual(startTime, endTime)) {
      return;
    }

    const thisTask = new AbortController();
    thisTask.signal.addEventListener("abort", () => {
      log.debug("Aborting preload task", startTime, endTime);
    });
    this._currentPreloadTask = thisTask;
    log.debug("Starting preload task", startTime, endTime);
    (async () => {
      const stream = streamMessages({
        api: this._consoleApi,
        signal: thisTask.signal,
        messageReadersByTopic: this._messageReadersByTopic,
        params: {
          deviceId: this._deviceId,
          start: startTime,
          end: endTime,
          topics: this._requestedTopics,
        },
      });

      for await (const { messages, range } of collateMessageStream(stream, {
        start: startTime,
        end: endTime,
      })) {
        if (thisTask.signal.aborted) {
          break;
        }
        log.debug("Adding preloaded chunk in", range, "with", messages.length, "messages");
        preloadedMessages.insert(range, messages);
        this._progress = {
          fullyLoadedFractionRanges: preloadedMessages.fullyLoadedFractionRanges(),
        };
        this._loadedMoreMessages?.resolve();
        this._loadedMoreMessages = undefined;
        this._emitState();
      }
    })()
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        log.error(error);
        this._addProblem("stream-error", { message: error.message, error, severity: "error" });
      })
      .finally(() => {
        if (this._currentPreloadTask === thisTask) {
          this._currentPreloadTask = undefined;
        }
      });

    this._emitState();
  }

  setPublishers(publishers: AdvertiseOptions[]): void {
    log.warn(`Publishing is not supported in ${this.constructor.name}`, publishers);
  }

  // Modify a remote parameter such as a rosparam.
  setParameter(_key: string, _value: ParameterValue): void {
    throw new Error(`Parameter modification is not supported in ${this.constructor.name}`);
  }

  publish(_request: PublishPayload): void {
    throw new Error(`Publishing is not supported in ${this.constructor.name}`);
  }

  startPlayback(): void {
    if (this._isPlaying) {
      return;
    }
    this._metricsCollector.play(this._speed);
    this._isPlaying = true;
    this._runPlaybackLoop();
    this._emitState();
  }

  pausePlayback(): void {
    if (!this._isPlaying) {
      return;
    }
    this._metricsCollector.pause();
    this._isPlaying = false;
    this._emitState();
  }

  seekPlayback(time: Time, _backfillDuration?: Time): void {
    log.debug("Seek", time);
    this._currentTime = time;
    this._lastSeekTime = Date.now();
    this._nextFrame = [];
    this._currentPreloadTask?.abort();
    this._currentPreloadTask = undefined;
    this._startPreloadTaskIfNeeded();
    this._emitState();
  }

  setPlaybackSpeed(speed: number): void {
    this._speed = speed;
    this._metricsCollector.setSpeed(speed);
    this._emitState();
  }

  requestBackfill(): void {
    // no-op
  }

  setGlobalVariables(_globalVariables: GlobalVariables): void {
    // no-op
  }
}
