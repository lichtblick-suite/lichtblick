// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { intersection } from "lodash";
import Queue from "promise-queue";
import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { Time, add, isLessThan } from "@foxglove/rostime";
import {
  AdvertisePayload,
  MessageEvent,
  ParameterValue,
  Player,
  PlayerPresence,
  PlayerState,
  Progress,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove/studio-base/players/types";
import {
  RandomAccessDataProvider,
  RandomAccessDataProviderMetadata,
  InitializationResult,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import sendNotification, {
  NotificationType,
  NotificationSeverity,
  DetailsType,
  detailsToString,
  setNotificationHandler,
} from "@foxglove/studio-base/util/sendNotification";
import { clampTime, subtractTimes, toMillis } from "@foxglove/studio-base/util/time";

const logger = Logger.getLogger(__filename);

export interface AutomatedRunClient {
  speed: number;
  msPerFrame: number;
  workerIndex?: number;
  workerTotal?: number;
  shouldLoadDataBeforePlaying: boolean;
  onError(arg0: unknown): Promise<void>;
  start(arg0: { bagLengthMs: number }): void;
  markTotalFrameStart(): void;
  markTotalFrameEnd(): void;
  markFrameRenderStart(): void;
  markFrameRenderEnd(): number;
  markPreloadStart(): void;
  markPreloadEnd(): number;
  onFrameFinished(frameIndex: number): Promise<void>;
  finish(): Promise<void>;
}

export const AUTOMATED_RUN_START_DELAY = process.env.NODE_ENV === "test" ? 10 : 2000;

function formatSeconds(sec: number): string {
  const date = new Date(0);
  date.setSeconds(sec);
  return date.toISOString().substr(11, 8);
}

export default class AutomatedRunPlayer implements Player {
  static className = "AutomatedRunPlayer";
  _isPlaying: boolean = false;
  _provider: RandomAccessDataProvider;
  _providerResult?: InitializationResult;
  _progress: Progress = {};
  _subscribedTopics: Set<string> = new Set();
  _listener?: (arg0: PlayerState) => Promise<void>;
  _initializeTimeout?: ReturnType<typeof setTimeout>;
  _initialized: boolean = false;
  _id: string = uuidv4();
  _speed: number;
  _msPerFrame: number;
  _client: AutomatedRunClient;
  _error?: Error;
  _waitToReportErrorPromise?: Promise<void>;
  _startCalled: boolean = false;
  _receivedBytes: number = 0;
  // Calls to this._listener must not happen concurrently, and we want them to happen
  // deterministically so we put them in a FIFO queue.
  _emitStateQueue: Queue = new Queue(1);

  constructor(provider: RandomAccessDataProvider, client: AutomatedRunClient) {
    this._provider = provider;
    this._speed = client.speed;
    this._msPerFrame = client.msPerFrame;
    this._client = client;
    // Report errors from sendNotification and those thrown on the window object to the client.
    setNotificationHandler(
      (
        message: string,
        details: DetailsType,
        type: NotificationType,
        severity: NotificationSeverity,
      ) => {
        if (severity === "warn") {
          // We can ignore warnings in automated runs
          return;
        }
        let error;
        if (type === "user") {
          error = new Error(`[STUDIO USER ERROR] ${message} // ${detailsToString(details)}`);
        } else if (type === "app") {
          error = new Error(`[STUDIO APPLICATION ERROR] ${detailsToString(details)}`);
        } else {
          error = new Error(`Unknown error type! ${type} // ${detailsToString(details)}`);
        }
        this._error = error;
        this._waitToReportErrorPromise = client.onError(error);
      },
    );
    window.addEventListener("error", (e: ErrorEvent) => {
      // This can happen when ResizeObserver can't resolve its callbacks fast enough, but we can ignore it.
      // See https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
      if (e.message.includes("ResizeObserver loop limit exceeded")) {
        return;
      }
      this._error = e.error;
      this._waitToReportErrorPromise = client.onError(e);
    });
  }

  async _getMessages(
    start: Time,
    end: Time,
  ): Promise<{ parsedMessages: readonly MessageEvent<unknown>[] }> {
    if (!this._providerResult) {
      throw new Error("AutomatedRunPlayer not initialized");
    }
    const providerResult = this._providerResult;

    const providerTopics = this._providerResult.topics.map(({ name }) => name);
    const parsedTopics = intersection(Array.from(this._subscribedTopics), providerTopics);

    if (parsedTopics.length === 0) {
      return { parsedMessages: [] };
    }
    const clampedStart = clampTime(start, this._providerResult.start, this._providerResult.end);
    const clampedEnd = clampTime(end, this._providerResult.start, this._providerResult.end);
    const messages = await this._provider.getMessages(clampedStart, clampedEnd, {
      parsedMessages: parsedTopics,
    });
    const { parsedMessages, rosBinaryMessages } = messages;
    if (
      (rosBinaryMessages != undefined && rosBinaryMessages.length > 0) ||
      parsedMessages == undefined
    ) {
      const messageTypes = (Object.keys(messages) as (keyof typeof messages)[])
        .filter((kind) => messages[kind]?.length)
        .join(",");
      throw new Error(`Invalid message types: ${messageTypes}`);
    }

    const filterMessages = (msgs: typeof parsedMessages) =>
      msgs.map((message) => {
        const topic: Topic | undefined = providerResult.topics.find(
          (t) => t.name === message.topic,
        );
        if (!topic) {
          throw new Error(`Could not find topic for message ${message.topic}`);
        }

        if (topic.datatype == undefined) {
          throw new Error(`Missing datatype for topic: ${message.topic}`);
        }
        return {
          topic: message.topic,
          receiveTime: message.receiveTime,
          message: message.message,
        };
      });
    return { parsedMessages: filterMessages(parsedMessages) };
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  _emitState(messages: readonly MessageEvent<unknown>[], currentTime: Time): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return this._emitStateQueue.add(() => {
      if (!this._listener) {
        return Promise.resolve();
      }
      const initializationResult = this._providerResult;
      if (!initializationResult) {
        throw new Error("AutomatedRunPlayer not initialized");
      }

      if (initializationResult.messageDefinitions.type === "raw") {
        throw new Error("AutomatedRunPlayer requires parsed message definitions");
      }
      return this._listener({
        presence: PlayerPresence.PRESENT,
        progress: this._progress,
        capabilities: [],
        playerId: this._id,
        activeData: {
          messages,
          totalBytesReceived: this._receivedBytes,
          currentTime,
          startTime: initializationResult.start,
          endTime: initializationResult.end,
          isPlaying: this._isPlaying,
          speed: this._speed,
          messageOrder: "receiveTime",
          lastSeekTime: 0,
          topics: initializationResult.topics,
          datatypes: initializationResult.messageDefinitions.datatypes,
          parsedMessageDefinitionsByTopic:
            initializationResult.messageDefinitions.parsedMessageDefinitionsByTopic,
        },
      });
    });
  }

  setListener(callback: (arg0: PlayerState) => Promise<void>): void {
    this._listener = callback;
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._subscribedTopics = new Set(subscriptions.map(({ topic }) => topic));

    // Wait with running until we've subscribed to a bunch of topics.
    if (this._initializeTimeout) {
      clearTimeout(this._initializeTimeout);
    }
    this._initializeTimeout = setTimeout(() => void this._initialize(), AUTOMATED_RUN_START_DELAY);
  }

  async _initialize(): Promise<void> {
    if (this._initialized) {
      return; // Prevent double loads.
    }
    this._initialized = true;

    this._providerResult = await this._provider.initialize({
      progressCallback: (progress: Progress) => {
        this._progress = progress;
        void this._onUpdateProgress();
      },
      reportMetadataCallback: (metadata: RandomAccessDataProviderMetadata) => {
        switch (metadata.type) {
          case "updateReconnecting":
            sendNotification(
              "updateReconnecting should never be called here",
              `AutomatedRunPlayer only supports local playback`,
              "app",
              "error",
            );
            break;
          case "average_throughput":
            // Don't need analytics for data provider callbacks in video generation.
            break;
          case "initializationPerformance":
            break;
          case "received_bytes":
            this._receivedBytes += metadata.bytes;
            break;
          case "data_provider_stall":
            break;
          default:
            break;
        }
      },
    });

    await this._start();
  }

  async _start(): Promise<void> {
    if (!this._providerResult) {
      throw new Error("AutomatedRunPlayer not initialized");
    }

    // Call _getMessages to start data loading and rendering for the first frame.
    const { parsedMessages } = await this._getMessages(
      this._providerResult.start,
      this._providerResult.start,
    );
    await this._emitState(parsedMessages, this._providerResult.start);
    if (!this._startCalled) {
      this._client.markPreloadStart();
    }

    this._startCalled = true;
    void this._maybeStartPlayback();
  }

  async _onUpdateProgress(): Promise<void> {
    if (this._client.shouldLoadDataBeforePlaying && this._providerResult != undefined) {
      // Update the view and do preloading calculations. Not necessary if we're already playing.
      void this._emitState([], this._providerResult.start);
    }
    void this._maybeStartPlayback();
  }

  async _maybeStartPlayback(): Promise<void> {
    if (this._readyToPlay()) {
      void this._run();
    }
  }

  _readyToPlay(): boolean {
    if (!this._startCalled || this._providerResult == undefined) {
      return false;
    }
    if (!this._client.shouldLoadDataBeforePlaying) {
      return true;
    }
    // If the client has shouldLoadDataBeforePlaying set to true, only start playback once all data has loaded.
    return (
      this._progress.fullyLoadedFractionRanges != undefined &&
      this._progress.fullyLoadedFractionRanges.length > 0 &&
      this._progress.fullyLoadedFractionRanges.every(({ start, end }) => start === 0 && end === 1)
    );
  }

  async _run(): Promise<void> {
    if (this._isPlaying) {
      return; // Only run once
    }

    if (!this._providerResult) {
      throw new Error("AutomatedRunPlayer not initialized");
    }

    this._isPlaying = true;
    this._client.markPreloadEnd();
    logger.info("AutomatedRunPlayer._run()");
    await this._emitState([], this._providerResult.start);

    let currentTime = this._providerResult.start;
    const workerIndex = this._client.workerIndex ?? 0;
    const workerCount = this._client.workerTotal ?? 1;

    const bagLengthMs = toMillis(
      subtractTimes(this._providerResult.end, this._providerResult.start),
    );
    this._client.start({ bagLengthMs });

    const startEpoch = Date.now();
    const nsBagTimePerFrame = Math.round(this._msPerFrame * this._speed * 1000000);

    // We split up the frames between the workers,
    // so we need to advance time based on the number of workers
    const nsFrameTimePerWorker = nsBagTimePerFrame * workerCount;
    currentTime = add(currentTime, { sec: 0, nsec: nsBagTimePerFrame * workerIndex });

    let frameCount = 0;
    while (isLessThan(currentTime, this._providerResult.end)) {
      if (this._waitToReportErrorPromise) {
        await this._waitToReportErrorPromise;
      }
      const end = add(currentTime, { sec: 0, nsec: nsFrameTimePerWorker });

      this._client.markTotalFrameStart();
      const { parsedMessages } = await this._getMessages(currentTime, end);
      this._client.markFrameRenderStart();

      // Wait for the frame render to finish.
      await this._emitState(parsedMessages, end);

      this._client.markTotalFrameEnd();
      const frameRenderDurationMs = this._client.markFrameRenderEnd();

      const bagTimeSinceStartMs = toMillis(subtractTimes(currentTime, this._providerResult.start));
      const percentComplete = bagTimeSinceStartMs / bagLengthMs;
      const msPerPercent = (Date.now() - startEpoch) / percentComplete;
      const estimatedSecondsRemaining = Math.round(((1 - percentComplete) * msPerPercent) / 1000);
      const eta = formatSeconds(
        Math.min(
          isNaN(estimatedSecondsRemaining) ? 0 : estimatedSecondsRemaining,
          24 * 60 * 60,
          /* 24 hours */
        ),
      );
      logger.info(
        `[${workerIndex}/${workerCount}] Recording ${(percentComplete * 100).toFixed(
          1,
        )}% done. ETA: ${eta}. Frame took ${frameRenderDurationMs}ms`,
      );

      await this._client.onFrameFinished(frameCount);

      currentTime = add(end, { sec: 0, nsec: 1 });
      frameCount++;
    }

    await this._client.finish();
    const totalDuration = (Date.now() - startEpoch) / 1000;
    logger.info(`AutomatedRunPlayer finished in ${formatSeconds(totalDuration)}`);
  }

  /* Public API shared functions */

  requestMessages(): void {
    // no-op
  }

  setPublishers(_publishers: AdvertisePayload[]): void {
    // no-op
  }

  setParameter(_key: string, _value: ParameterValue): void {
    throw new Error(`Unsupported in AutomatedRunPlayer`);
  }

  publish(_payload: PublishPayload): void {
    throw new Error(`Unsupported in AutomatedRunPlayer`);
  }

  async close(): Promise<void> {
    throw new Error(`Unsupported in AutomatedRunPlayer`);
  }

  startPlayback(): void {
    throw new Error(`Unsupported in AutomatedRunPlayer`);
  }

  pausePlayback(): void {
    throw new Error(`Unsupported in AutomatedRunPlayer`);
  }

  setPlaybackSpeed(_speed: number): void {
    // This should be passed into the constructor and should not be changed.
  }

  seekPlayback(_time: Time): void {
    throw new Error(`Unsupported in AutomatedRunPlayer`);
  }

  requestBackfill(): void {
    // no-op
  }
  setGlobalVariables(): void {
    throw new Error(`Unsupported in AutomatedRunPlayer`);
  }
}
