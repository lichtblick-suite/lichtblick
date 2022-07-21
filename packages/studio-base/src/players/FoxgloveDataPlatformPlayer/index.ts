// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { captureException } from "@sentry/core";
import { isEqual, maxBy, minBy, partition, uniq } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { signal, Signal, debouncePromise } from "@foxglove/den/async";
import Logger from "@foxglove/log";
import { parseChannel } from "@foxglove/mcap-support";
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
import { ParameterValue } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerProblem,
  PlayerState,
  Progress,
  PublishPayload,
  SubscribePayload,
  SubscriptionPreloadType,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import MessageMemoryCache from "./MessageMemoryCache";
import collateMessageStream from "./collateMessageStream";
import streamMessages, { ParsedChannelAndEncodings } from "./streamMessages";

const log = Logger.getLogger(__filename);

const CAPABILITIES = [PlayerCapabilities.playbackControl, PlayerCapabilities.setSpeed];

type FoxgloveDataPlatformPlayerOpts = {
  consoleApi: ConsoleApi;
  params: {
    start: string;
    end: string;
    seek?: string;
    deviceId: string;
  };
  metricsCollector: PlayerMetricsCollectorInterface;
  sourceId: string;
};

export default class FoxgloveDataPlatformPlayer implements Player {
  private readonly _preloadThresholdSecs = 5;
  private readonly _preloadDurationSecs = 15;

  private _id: string = uuidv4(); // Unique ID for this player
  private _name: string;
  private _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState()
  private _totalBytesReceived = 0;
  private _caches: Partial<Record<SubscriptionPreloadType, MessageMemoryCache>> = {
    full: undefined,
    partial: undefined,
  };
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
  private _topicsStats = new Map<string, TopicStats>();
  private _subscriptions: Record<SubscriptionPreloadType, SubscribePayload[]> = {
    full: [],
    partial: [],
  };
  private _datatypes: RosDatatypes = new Map();
  private _metricsCollector: PlayerMetricsCollectorInterface;
  private _presence: PlayerPresence = PlayerPresence.INITIALIZING;
  private _currentPreloadTasks: Record<SubscriptionPreloadType, undefined | AbortController> = {
    full: undefined,
    partial: undefined,
  };
  private _progress: Progress = {};
  private _loadedMoreMessages?: Signal<void>;
  private _nextFrame: MessageEvent<unknown>[] = [];
  private readonly _sourceId: string;

  /**
   * Cached readers for each schema so we don't have to re-parse definitions on each stream request.
   * Although each topic is usually homogeneous, technically it is possible to have different
   * encoding or schema for each topic, so we store all the ones we've seen.
   */
  private _parsedChannelsByTopic = new Map<string, ParsedChannelAndEncodings[]>();

  // track issues within the player
  private _problems: PlayerProblem[] = [];
  private _problemsById = new Map<string, PlayerProblem>();

  constructor({ params, metricsCollector, consoleApi, sourceId }: FoxgloveDataPlatformPlayerOpts) {
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
    this._sourceId = sourceId;
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
    const coverageStart = minBy(coverage, (c) => c.start);
    const coverageEnd = maxBy(coverage, (c) => c.end);
    const coverageStartTime = coverageStart ? fromRFC3339String(coverageStart.start) : undefined;
    const coverageEndTime = coverageEnd ? fromRFC3339String(coverageEnd.end) : undefined;
    if (!coverageStartTime || !coverageEndTime) {
      throw new Error(
        `Invalid coverage response, start: ${coverage[0]!.start}, end: ${
          coverage[coverage.length - 1]!.end
        }`,
      );
    }
    if (isLessThan(this._start, coverageStartTime)) {
      log.debug("Increased start time from", this._start, "to", coverageStartTime);
      this._start = coverageStartTime;
    }
    if (isGreaterThan(this._end, coverageEndTime)) {
      log.debug("Reduced end time from", this._end, "to", coverageEndTime);
      this._end = coverageEndTime;
    }

    // During startup, seekPlayback might get called to set the currentTime. This might change the
    // currentTime from the initial value set in the constructor. So we clamp the currentTime to the
    // new start/end range in the event.
    this._currentTime = clampTime(this._currentTime, this._start, this._end);

    const topics: Topic[] = [];
    // TODO(jhurliman): Fill numMessages into topicStats per topic. Bonus points if we can get
    // firstMessageTime / lastMessageTime per topic as well
    const topicStats = new Map<string, TopicStats>();
    const datatypes: RosDatatypes = new Map();
    rawTopics: for (const rawTopic of rawTopics) {
      const { topic, encoding: messageEncoding, schemaEncoding, schema, schemaName } = rawTopic;
      if (schema == undefined) {
        throw new Error(`missing requested schema for ${topic}`);
      }

      let parsedChannels = this._parsedChannelsByTopic.get(topic);
      if (!parsedChannels) {
        parsedChannels = [];
        this._parsedChannelsByTopic.set(topic, parsedChannels);
      }
      for (const info of parsedChannels) {
        if (
          info.messageEncoding === messageEncoding &&
          info.schemaEncoding === schemaEncoding &&
          isEqual(info.schema, schema)
        ) {
          continue rawTopics;
        }
      }

      const parsedChannel = parseChannel({
        messageEncoding,
        schema: { name: schemaName, data: schema, encoding: schemaEncoding },
      });

      topics.push({ name: topic, datatype: parsedChannel.fullSchemaName });
      parsedChannels.push({ messageEncoding, schemaEncoding, schema, parsedChannel });

      // Final datatypes is an unholy union of schemas across all channels
      for (const [name, datatype] of parsedChannel.datatypes) {
        datatypes.set(name, datatype);
      }
    }
    this._topics = topics;
    this._topicsStats = topicStats;
    this._datatypes = datatypes;

    this._presence = PlayerPresence.PRESENT;
    this._caches.full = new MessageMemoryCache({ start: this._start, end: this._end });
    this._caches.partial = new MessageMemoryCache({ start: this._start, end: this._end });
    this._metricsCollector.initialized();
    this._emitState();
    this._startPreloadTaskIfNeeded("full");
    this._startPreloadTaskIfNeeded("partial");
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
      profile: undefined,
      playerId: this._id,
      problems: this._problems,
      urlState: {
        sourceId: this._sourceId,
        parameters: {
          start: toRFC3339String(this._start),
          end: toRFC3339String(this._end),
          deviceId: this._deviceId,
        },
      },

      activeData: {
        messages,
        totalBytesReceived: this._totalBytesReceived,
        startTime: this._start,
        endTime: this._end,
        currentTime: this._currentTime,
        isPlaying: this._isPlaying,
        speed: this._speed,
        lastSeekTime: this._lastSeekTime ?? 0,
        topics: this._topics,
        topicStats: this._topicsStats,
        datatypes: this._datatypes,
        publishedTopics: undefined,
        subscribedTopics: undefined,
        services: undefined,
        parameters: undefined,
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
    this._currentPreloadTasks.full?.abort();
    this._currentPreloadTasks.partial?.abort();
    this._currentPreloadTasks = { full: undefined, partial: undefined };
    this._totalBytesReceived = 0;
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    log.debug("setSubscriptions", subscriptions);
    [this._subscriptions.full, this._subscriptions.partial] = partition(
      subscriptions,
      (s) => s.preloadType === "full",
    );
    this._clearPreloadedData();
    this._startPreloadTaskIfNeeded("full");
    this._startPreloadTaskIfNeeded("partial");
    this._emitState();
  }

  private _runPlaybackLoop = debouncePromise(async () => {
    if (!this._caches.partial) {
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
      if (this._subscriptions.partial.length > 0) {
        let messages;
        while (
          !(messages = this._caches.partial.getMessages({
            start: startTime,
            end: endTime,
          }))
        ) {
          this._startPreloadTaskIfNeeded("partial");
          log.debug("Waiting for more messages");
          // Wait for new messages to be loaded
          await (this._loadedMoreMessages = signal());
          if (this._lastSeekTime !== lastSeekTime) {
            lastTickEndTime = undefined;
            continue mainLoop;
          }
          if (this._presence === PlayerPresence.ERROR) {
            // Avoid persistently re-requesting data if we encountered a parsing error
            return;
          }
        }
        lastTickEndTime = performance.now();
        this._nextFrame = messages;
      } else {
        this._nextFrame = [];
      }
      this._currentTime = endTime;
      if (areEqual(this._currentTime, this._end)) {
        this._isPlaying = false;
      }
      this._emitState();
    }
  });

  private _clearPreloadedData() {
    this._currentPreloadTasks.full?.abort();
    this._currentPreloadTasks.partial?.abort();
    this._currentPreloadTasks = { full: undefined, partial: undefined };

    this._caches.full?.clear();
    this._caches.partial?.clear();
    this._updateProgress();
  }

  private _startPreloadTaskIfNeeded(preloadType: SubscriptionPreloadType) {
    const preloadedMessages = this._caches[preloadType];

    if (!preloadedMessages || this._closed) {
      return;
    }

    if (this._currentPreloadTasks[preloadType]) {
      return;
    }

    const topics = uniq(this._subscriptions[preloadType].map((s) => s.topic));
    if (topics.length === 0) {
      return;
    }

    const nextRangeToLoad = preloadedMessages.nextRangeToLoad(
      preloadType === "full" ? this._start : this._currentTime,
    );
    if (nextRangeToLoad == undefined) {
      return;
    }

    const shouldPreload =
      preloadType === "full" ||
      toSec(subtract(nextRangeToLoad.start, this._currentTime)) < this._preloadThresholdSecs;
    if (!shouldPreload) {
      return;
    }

    const startTime = nextRangeToLoad.start;
    const endTime = clampTime(
      preloadType === "full" ? this._end : add(startTime, fromSec(this._preloadDurationSecs)),
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
    this._currentPreloadTasks[preloadType] = thisTask;
    log.debug("Starting preload task", startTime, endTime);

    (async () => {
      const stream = streamMessages({
        api: this._consoleApi,
        signal: thisTask.signal,
        parsedChannelsByTopic: this._parsedChannelsByTopic,
        params: {
          deviceId: this._deviceId,
          start: startTime,
          end: endTime,
          topics,
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
        this._updateProgress();
        if (preloadType === "partial") {
          this._loadedMoreMessages?.resolve();
          this._loadedMoreMessages = undefined;
        }
        this._emitState();
      }
    })()
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        this._presence = PlayerPresence.ERROR;
        log.error(error);
        captureException(error);
        this._addProblem("stream-error", { message: error.message, error, severity: "error" });
      })
      .finally(() => {
        log.debug("Ending preload task", startTime, endTime);
        if (this._currentPreloadTasks[preloadType] === thisTask) {
          this._currentPreloadTasks[preloadType] = undefined;
        }
        // Wake up any waiters that may have been waiting for more messages. While there may be no
        // more messages available (since we would've already woken them up to consume messages
        // inside the `for await` loop above), it's important that we wake them up *after*
        // `this._currentPreloadTasks[preloadType] = undefined`, so they can call
        // `_startPreloadTaskIfNeeded` again and have it actually start a new task.
        this._loadedMoreMessages?.resolve();
        this._loadedMoreMessages = undefined;
      });

    this._emitState();
  }

  private _updateProgress() {
    const noFullTopics = this._subscriptions.full.length === 0;
    const cache = noFullTopics ? this._caches.partial : this._caches.full;
    if (cache) {
      this._progress = {
        fullyLoadedFractionRanges: cache.fullyLoadedFractionRanges(),
        messageCache: cache.getBlockCache(),
      };
    }
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

  async callService(): Promise<unknown> {
    throw new Error(`Service calls are not supported in ${this.constructor.name}`);
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
    this._currentTime = clampTime(time, this._start, this._end);
    this._lastSeekTime = Date.now();
    this._nextFrame = [];
    this._currentPreloadTasks.full?.abort();
    this._currentPreloadTasks.partial?.abort();
    this._currentPreloadTasks = { full: undefined, partial: undefined };
    this._startPreloadTaskIfNeeded("partial");
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
