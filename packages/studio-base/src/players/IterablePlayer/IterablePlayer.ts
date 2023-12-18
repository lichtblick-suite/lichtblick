// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import assert from "assert";
import * as _ from "lodash-es";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import {
  Time,
  add,
  clampTime,
  compare,
  fromMillis,
  fromNanoSec,
  toRFC3339String,
  toString,
} from "@foxglove/rostime";
import { MessageEvent, ParameterValue } from "@foxglove/studio";
import NoopMetricsCollector from "@foxglove/studio-base/players/NoopMetricsCollector";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import {
  AdvertiseOptions,
  Player,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
  Progress,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicSelection,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import delay from "@foxglove/studio-base/util/delay";

import { BlockLoader } from "./BlockLoader";
import { BufferedIterableSource } from "./BufferedIterableSource";
import { IIterableSource, IteratorResult } from "./IIterableSource";

const log = Log.getLogger(__filename);

// Number of bytes that we aim to keep in the cache.
// Setting this to higher than 1.5GB caused the renderer process to crash on linux.
// See: https://github.com/foxglove/studio/pull/1733
const DEFAULT_CACHE_SIZE_BYTES = 1.0e9;

// Amount to wait until panels have had the chance to subscribe to topics before
// we start playback
const START_DELAY_MS = 100;

// Messages are laid out in blocks with a fixed number of milliseconds.
const MIN_MEM_CACHE_BLOCK_SIZE_NS = 0.1e9;

// Original comment from webviz:
// Preloading algorithms slow when there are too many blocks.
// Adaptive block sizing is simpler than using a tree structure for immutable updates but
// less flexible, so we may want to move away from a single-level block structure in the future.
const MAX_BLOCKS = 400;

// Amount to seek into the data source from the start when loading the player. The purpose of this
// is to provide some initial data to subscribers.
const SEEK_ON_START_NS = BigInt(99 * 1e6);

const MEMORY_INFO_BUFFERED_MSGS = "Buffered messages";

type IterablePlayerOptions = {
  metricsCollector?: PlayerMetricsCollectorInterface;

  source: IIterableSource;

  // Optional player name
  name?: string;

  // Optional set of key/values to store with url handling
  urlParams?: Record<string, string>;

  // Source identifier used in constructing state urls.
  sourceId: string;

  isSampleDataSource?: boolean;

  // Set to _false_ to disable preloading. (default: true)
  enablePreload?: boolean;
};

type IterablePlayerState =
  | "preinit"
  | "initialize"
  | "start-play"
  | "idle"
  | "seek-backfill"
  | "play"
  | "close"
  | "reset-playback-iterator";

/**
 * IterablePlayer implements the Player interface for IIterableSource instances.
 *
 * The iterable player reads messages from an IIterableSource. The player is implemented as a state
 * machine. Each state runs until it finishes. A request to change state is handled by each state
 * detecting that there is another state waiting and cooperatively ending itself.
 */
export class IterablePlayer implements Player {
  #urlParams?: Record<string, string>;
  #name?: string;
  #nextState?: IterablePlayerState;
  #state: IterablePlayerState = "preinit";
  #runningState: boolean = false;

  #isPlaying: boolean = false;
  #listener?: (playerState: PlayerState) => Promise<void>;
  #speed: number = 1.0;
  #start?: Time;
  #end?: Time;
  #enablePreload = true;

  // next read start time indicates where to start reading for the next tick
  // after a tick read, it is set to 1nsec past the end of the read operation (preparing for the next tick)
  #lastTickMillis?: number;
  // This is the "lastSeekTime" emitted in the playerState. This indicates the emit is due to a seek.
  #lastSeekEmitTime: number = Date.now();

  #providerTopics: Topic[] = [];
  #providerTopicStats = new Map<string, TopicStats>();
  #providerDatatypes: RosDatatypes = new Map();

  #capabilities: string[] = [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl];
  #profile: string | undefined;
  #metricsCollector: PlayerMetricsCollectorInterface;
  #subscriptions: SubscribePayload[] = [];
  #allTopics: TopicSelection = new Map();
  #preloadTopics: TopicSelection = new Map();

  #progress: Progress = {};
  #id: string = uuidv4();
  #messages: MessageEvent[] = [];
  #receivedBytes: number = 0;
  #hasError = false;
  #lastRangeMillis?: number;
  #lastMessageEvent?: MessageEvent;
  #lastStamp?: Time;
  #publishedTopics = new Map<string, Set<string>>();
  #seekTarget?: Time;
  #presence = PlayerPresence.INITIALIZING;

  // To keep reference equality for downstream user memoization cache the currentTime provided in the last activeData update
  // See additional comments below where _currentTime is set
  #currentTime?: Time;

  #problemManager = new PlayerProblemManager();

  #iterableSource: IIterableSource;
  #bufferedSource: BufferedIterableSource;

  // Some states register an abort controller to signal they should abort
  #abort?: AbortController;

  // The iterator for reading messages during playback
  #playbackIterator?: AsyncIterator<Readonly<IteratorResult>>;

  #blockLoader?: BlockLoader;
  #blockLoadingProcess?: Promise<void>;

  #queueEmitState: ReturnType<typeof debouncePromise>;

  readonly #sourceId: string;

  #untilTime?: Time;

  /** Promise that resolves when the player is closed. Only used for testing currently */
  public readonly isClosed: Promise<void>;
  #resolveIsClosed: () => void = () => {};

  public constructor(options: IterablePlayerOptions) {
    const { metricsCollector, urlParams, source, name, enablePreload, sourceId } = options;

    this.#iterableSource = source;
    this.#bufferedSource = new BufferedIterableSource(source);
    this.#name = name;
    this.#urlParams = urlParams;
    this.#metricsCollector = metricsCollector ?? new NoopMetricsCollector();
    this.#metricsCollector.playerConstructed();
    this.#enablePreload = enablePreload ?? true;
    this.#sourceId = sourceId;

    this.isClosed = new Promise((resolveClose) => {
      this.#resolveIsClosed = resolveClose;
    });

    // Wrap emitStateImpl in a debouncePromise for our states to call. Since we can emit from states
    // or from block loading updates we use debouncePromise to guard against concurrent emits.
    this.#queueEmitState = debouncePromise(this.#emitStateImpl.bind(this));
  }

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    if (this.#listener) {
      throw new Error("Cannot setListener again");
    }
    this.#listener = listener;
    this.#setState("initialize");
  }

  public startPlayback(): void {
    this.#startPlayImpl();
  }

  public playUntil(time: Time): void {
    this.#startPlayImpl({ untilTime: time });
  }

  #startPlayImpl(opt?: { untilTime: Time }): void {
    if (this.#isPlaying || this.#untilTime != undefined || !this.#start || !this.#end) {
      return;
    }

    if (opt?.untilTime) {
      if (this.#currentTime && compare(opt.untilTime, this.#currentTime) <= 0) {
        throw new Error("Invariant: playUntil time must be after the current time");
      }
      this.#untilTime = clampTime(opt.untilTime, this.#start, this.#end);
    }
    this.#metricsCollector.play(this.#speed);
    this.#isPlaying = true;

    // If we are idling we can start playing, if we have a next state queued we let that state
    // finish and it will see that we should be playing
    if (this.#state === "idle" && (!this.#nextState || this.#nextState === "idle")) {
      this.#setState("play");
    } else {
      this.#queueEmitState(); // update isPlaying state to UI
    }
  }

  public pausePlayback(): void {
    if (!this.#isPlaying) {
      return;
    }
    this.#metricsCollector.pause();
    // clear out last tick millis so we don't read a huge chunk when we unpause
    this.#lastTickMillis = undefined;
    this.#isPlaying = false;
    this.#untilTime = undefined;
    this.#lastRangeMillis = undefined;
    if (this.#state === "play") {
      this.#setState("idle");
    } else {
      this.#queueEmitState(); // update isPlaying state to UI
    }
  }

  public setPlaybackSpeed(speed: number): void {
    this.#lastRangeMillis = undefined;
    this.#speed = speed;
    this.#metricsCollector.setSpeed(speed);

    // Queue event state update to update speed in player state to UI
    this.#queueEmitState();
  }

  public seekPlayback(time: Time): void {
    // Wait to perform seek until initialization is complete
    if (this.#state === "preinit" || this.#state === "initialize") {
      log.debug(`Ignoring seek, state=${this.#state}`);
      this.#seekTarget = time;
      return;
    }

    if (!this.#start || !this.#end) {
      throw new Error("invariant: initialized but no start/end set");
    }

    // Limit seek to within the valid range
    const targetTime = clampTime(time, this.#start, this.#end);

    // We are already seeking to this time, no need to reset seeking
    if (this.#seekTarget && compare(this.#seekTarget, targetTime) === 0) {
      log.debug(`Ignoring seek, already seeking to this time`);
      return;
    }

    // We are already at this time, no need to reset seeking
    if (this.#currentTime && compare(this.#currentTime, targetTime) === 0) {
      log.debug(`Ignoring seek, already at this time`);
      return;
    }

    this.#metricsCollector.seek(targetTime);
    this.#seekTarget = targetTime;
    this.#untilTime = undefined;
    this.#lastTickMillis = undefined;
    this.#lastRangeMillis = undefined;

    this.#setState("seek-backfill");
  }

  public setSubscriptions(newSubscriptions: SubscribePayload[]): void {
    log.debug("set subscriptions", newSubscriptions);
    this.#subscriptions = newSubscriptions;
    this.#metricsCollector.setSubscriptions(newSubscriptions);

    const allTopics: TopicSelection = new Map(
      this.#subscriptions.map((subscription) => [subscription.topic, subscription]),
    );
    const preloadTopics = new Map(
      filterMap(this.#subscriptions, (sub) =>
        sub.preloadType === "full" ? [sub.topic, sub] : undefined,
      ),
    );

    // If there are no changes to topics there's no reason to perform a "seek" to trigger loading
    if (_.isEqual(allTopics, this.#allTopics) && _.isEqual(preloadTopics, this.#preloadTopics)) {
      return;
    }

    this.#allTopics = allTopics;
    this.#preloadTopics = preloadTopics;
    this.#blockLoader?.setTopics(this.#preloadTopics);

    // If the player is playing, the playing state will detect any subscription changes and adjust
    // iterators accordingly. However if we are idle or already seeking then we need to manually
    // trigger the backfill.
    if (
      this.#state === "idle" ||
      this.#state === "seek-backfill" ||
      this.#state === "play" ||
      this.#state === "start-play"
    ) {
      if (!this.#isPlaying && this.#currentTime) {
        this.#seekTarget ??= this.#currentTime;
        this.#untilTime = undefined;
        this.#lastTickMillis = undefined;
        this.#lastRangeMillis = undefined;

        // Trigger a seek backfill to load any missing messages and reset the forward iterator
        this.#setState("seek-backfill");
      }
    }
  }

  public setPublishers(_publishers: AdvertiseOptions[]): void {
    // no-op
  }

  public setParameter(_key: string, _value: ParameterValue): void {
    throw new Error("Parameter editing is not supported by this data source");
  }

  public publish(_payload: PublishPayload): void {
    throw new Error("Publishing is not supported by this data source");
  }

  public async callService(): Promise<unknown> {
    throw new Error("Service calls are not supported by this data source");
  }

  public close(): void {
    this.#setState("close");
  }

  public setGlobalVariables(): void {
    // no-op
  }

  /** Request the state to switch to newState */
  #setState(newState: IterablePlayerState) {
    // nothing should override closing the player
    if (this.#nextState === "close") {
      return;
    }
    log.debug(`Set next state: ${newState}`);
    this.#nextState = newState;
    this.#abort?.abort();
    this.#abort = undefined;
    void this.#runState();
  }

  /**
   * Run the requested state while there is a state to run.
   *
   * Ensures that only one state is running at a time.
   * */
  async #runState() {
    if (this.#runningState) {
      return;
    }

    this.#runningState = true;
    try {
      while (this.#nextState) {
        const state = (this.#state = this.#nextState);
        this.#nextState = undefined;

        log.debug(`Start state: ${state}`);

        // If we are going into a state other than play or idle we throw away the playback iterator since
        // we will need to make a new one.
        if (state !== "idle" && state !== "play" && this.#playbackIterator) {
          log.debug("Ending playback iterator because next state is not IDLE or PLAY");
          await this.#playbackIterator.return?.();
          this.#playbackIterator = undefined;
        }

        switch (state) {
          case "preinit":
            this.#queueEmitState();
            break;
          case "initialize":
            await this.#stateInitialize();
            break;
          case "start-play":
            await this.#stateStartPlay();
            break;
          case "idle":
            await this.#stateIdle();
            break;
          case "seek-backfill":
            // We allow aborting requests when moving on to the next state
            await this.#stateSeekBackfill();
            break;
          case "play":
            await this.#statePlay();
            break;
          case "close":
            await this.#stateClose();
            break;
          case "reset-playback-iterator":
            await this.#stateResetPlaybackIterator();
        }

        log.debug(`Done state ${state}`);
      }
    } catch (err) {
      log.error(err);
      this.#setError((err as Error).message, err);
      this.#queueEmitState();
    } finally {
      this.#runningState = false;
    }
  }

  #setError(message: string, error?: Error): void {
    this.#hasError = true;
    this.#problemManager.addProblem("global-error", {
      severity: "error",
      message,
      error,
    });
    this.#isPlaying = false;
  }

  // Initialize the source and player members
  async #stateInitialize(): Promise<void> {
    // emit state indicating start of initialization
    this.#queueEmitState();

    try {
      const {
        start,
        end,
        topics,
        profile,
        topicStats,
        problems,
        publishersByTopic,
        datatypes,
        name,
      } = await this.#bufferedSource.initialize();

      // Prior to initialization, the seekTarget may have been set to an out-of-bounds value
      // This brings the value in bounds
      if (this.#seekTarget) {
        this.#seekTarget = clampTime(this.#seekTarget, start, end);
      }

      this.#profile = profile;
      this.#start = start;
      this.#currentTime = this.#seekTarget ?? start;
      this.#end = end;
      this.#publishedTopics = publishersByTopic;
      this.#providerDatatypes = datatypes;
      this.#name = name ?? this.#name;

      // Studio does not like duplicate topics or topics with different datatypes
      // Check for duplicates or for mismatched datatypes
      const uniqueTopics = new Map<string, Topic>();
      for (const topic of topics) {
        const existingTopic = uniqueTopics.get(topic.name);
        if (existingTopic) {
          problems.push({
            severity: "warn",
            message: `Inconsistent datatype for topic: ${topic.name}`,
            tip: `Topic ${topic.name} has messages with multiple datatypes: ${existingTopic.schemaName}, ${topic.schemaName}. This may result in errors during visualization.`,
          });
          continue;
        }

        uniqueTopics.set(topic.name, topic);
      }

      this.#providerTopics = Array.from(uniqueTopics.values());
      this.#providerTopicStats = topicStats;

      let idx = 0;
      for (const problem of problems) {
        this.#problemManager.addProblem(`init-problem-${idx}`, problem);
        idx += 1;
      }

      if (this.#enablePreload) {
        // --- setup block loader which loads messages for _full_ subscriptions in the "background"
        try {
          this.#blockLoader = new BlockLoader({
            cacheSizeBytes: DEFAULT_CACHE_SIZE_BYTES,
            source: this.#iterableSource,
            start: this.#start,
            end: this.#end,
            maxBlocks: MAX_BLOCKS,
            minBlockDurationNs: MIN_MEM_CACHE_BLOCK_SIZE_NS,
            problemManager: this.#problemManager,
          });
        } catch (err) {
          log.error(err);

          const startStr = toRFC3339String(this.#start);
          const endStr = toRFC3339String(this.#end);

          this.#problemManager.addProblem("block-loader", {
            severity: "warn",
            message: "Failed to initialize message preloading",
            tip: `The start (${startStr}) and end (${endStr}) of your data is too far apart.`,
            error: err,
          });
        }
      }

      this.#presence = PlayerPresence.PRESENT;
    } catch (error) {
      this.#setError(`Error initializing: ${error.message}`, error);
    }
    this.#queueEmitState();

    if (!this.#hasError && this.#start) {
      // Wait a bit until panels have had the chance to subscribe to topics before we start
      // playback.
      await delay(START_DELAY_MS);

      this.#blockLoader?.setTopics(this.#preloadTopics);

      // Block loadings is constantly running and tries to keep the preloaded messages in memory
      this.#blockLoadingProcess = this.#startBlockLoading().catch((err) => {
        this.#setError((err as Error).message, err as Error);
      });

      this.#setState("start-play");
    }
  }

  async #resetPlaybackIterator() {
    if (!this.#currentTime) {
      throw new Error("Invariant: Tried to reset playback iterator with no current time.");
    }

    const next = add(this.#currentTime, { sec: 0, nsec: 1 });

    log.debug("Ending previous iterator");
    await this.#playbackIterator?.return?.();

    // set the playIterator to the seek time
    await this.#bufferedSource.stopProducer();

    log.debug("Initializing forward iterator from", next);
    this.#playbackIterator = this.#bufferedSource.messageIterator({
      topics: this.#allTopics,
      start: next,
      consumptionType: "partial",
    });
  }

  async #stateResetPlaybackIterator() {
    if (!this.#currentTime) {
      throw new Error("Invariant: Tried to reset playback iterator with no current time.");
    }

    await this.#resetPlaybackIterator();
    this.#setState(this.#isPlaying ? "play" : "idle");
  }

  // Read a small amount of data from the data source with the hope of producing a message or two.
  // Without an initial read, the user would be looking at a blank layout since no messages have yet
  // been delivered.
  async #stateStartPlay() {
    if (!this.#start || !this.#end) {
      throw new Error("Invariant: start and end must be set");
    }

    // If we have a target seek time, the seekPlayback function will take care of backfilling messages.
    if (this.#seekTarget) {
      this.#setState("seek-backfill");
      return;
    }

    const stopTime = clampTime(
      add(this.#start, fromNanoSec(SEEK_ON_START_NS)),
      this.#start,
      this.#end,
    );

    log.debug(`Playing from ${toString(this.#start)} to ${toString(stopTime)}`);

    if (this.#playbackIterator) {
      throw new Error("Invariant. playbackIterator was already set");
    }

    log.debug("Initializing forward iterator from", this.#start);
    this.#playbackIterator = this.#bufferedSource.messageIterator({
      topics: this.#allTopics,
      start: this.#start,
      consumptionType: "partial",
    });

    this.#lastMessageEvent = undefined;
    this.#messages = [];

    const messageEvents: MessageEvent[] = [];

    // If we take too long to read the data, we set the player into a BUFFERING presence. This
    // indicates that the player is waiting to load more data.
    const tickTimeout = setTimeout(() => {
      this.#presence = PlayerPresence.BUFFERING;
      this.#queueEmitState();
    }, 100);

    try {
      for (;;) {
        const result = await this.#playbackIterator.next();
        if (result.done === true) {
          break;
        }
        const iterResult = result.value;
        // Bail if a new state is requested while we are loading messages
        // This usually happens when seeking before the initial load is complete
        if (this.#nextState) {
          return;
        }

        if (iterResult.type === "problem") {
          this.#problemManager.addProblem(`connid-${iterResult.connectionId}`, iterResult.problem);
          continue;
        }

        if (iterResult.type === "stamp" && compare(iterResult.stamp, stopTime) >= 0) {
          this.#lastStamp = iterResult.stamp;
          break;
        }

        if (iterResult.type === "message-event") {
          // The message is past the tick end time, we need to save it for next tick
          if (compare(iterResult.msgEvent.receiveTime, stopTime) > 0) {
            this.#lastMessageEvent = iterResult.msgEvent;
            break;
          }

          messageEvents.push(iterResult.msgEvent);
        }
      }
    } finally {
      clearTimeout(tickTimeout);
    }

    this.#currentTime = stopTime;
    this.#messages = messageEvents;
    this.#presence = PlayerPresence.PRESENT;
    this.#queueEmitState();
    this.#setState("idle");
  }

  // Process a seek request. The seek is performed by requesting a getBackfillMessages from the source.
  // This provides the last message on all subscribed topics.
  async #stateSeekBackfill() {
    if (!this.#start || !this.#end) {
      throw new Error("invariant: stateSeekBackfill prior to initialization");
    }

    if (!this.#seekTarget) {
      return;
    }

    // Ensure the seek time is always within the data source bounds
    const targetTime = clampTime(this.#seekTarget, this.#start, this.#end);

    this.#lastMessageEvent = undefined;

    // If the backfill does not complete within 100 milliseconds, we emit with no messages to
    // indicate buffering. This provides feedback to the user that we've acknowledged their seek
    // request but haven't loaded the data.
    //
    // Note: we explicitly avoid setting _lastSeekEmitTime so panels do not reset visualizations
    const seekAckTimeout = setTimeout(() => {
      this.#presence = PlayerPresence.BUFFERING;
      this.#messages = [];
      this.#currentTime = targetTime;
      this.#queueEmitState();
    }, 100);

    try {
      this.#abort = new AbortController();
      const messages = await this.#bufferedSource.getBackfillMessages({
        topics: this.#allTopics,
        time: targetTime,
        abortSignal: this.#abort.signal,
      });

      // We've successfully loaded the messages and will emit those, no longer need the ackTimeout
      clearTimeout(seekAckTimeout);

      if (this.#nextState) {
        return;
      }

      this.#messages = messages;
      this.#currentTime = targetTime;
      this.#lastSeekEmitTime = Date.now();
      this.#presence = PlayerPresence.PRESENT;
      this.#queueEmitState();
      await this.#resetPlaybackIterator();
      this.#setState(this.#isPlaying ? "play" : "idle");
    } catch (err) {
      if (this.#nextState && err.name === "AbortError") {
        log.debug("Aborted backfill");
      } else {
        throw err;
      }
    } finally {
      // Unless the next state is a seek backfill, we clear the seek target since we have finished seeking
      if (this.#nextState !== "seek-backfill") {
        this.#seekTarget = undefined;
      }
      clearTimeout(seekAckTimeout);
      this.#abort = undefined;
    }
  }

  /** Emit the player state to the registered listener */
  async #emitStateImpl() {
    if (!this.#listener) {
      return;
    }

    if (this.#hasError) {
      await this.#listener({
        name: this.#name,
        presence: PlayerPresence.ERROR,
        progress: {},
        capabilities: this.#capabilities,
        profile: this.#profile,
        playerId: this.#id,
        activeData: undefined,
        problems: this.#problemManager.problems(),
        urlState: {
          sourceId: this.#sourceId,
          parameters: this.#urlParams,
        },
      });
      return;
    }

    const messages = this.#messages;
    this.#messages = [];

    let activeData: PlayerStateActiveData | undefined;
    if (this.#start && this.#end && this.#currentTime) {
      activeData = {
        messages,
        totalBytesReceived: this.#receivedBytes,
        currentTime: this.#currentTime,
        startTime: this.#start,
        endTime: this.#end,
        isPlaying: this.#isPlaying,
        speed: this.#speed,
        lastSeekTime: this.#lastSeekEmitTime,
        topics: this.#providerTopics,
        topicStats: this.#providerTopicStats,
        datatypes: this.#providerDatatypes,
        publishedTopics: this.#publishedTopics,
      };
    }

    const data: PlayerState = {
      name: this.#name,
      presence: this.#presence,
      progress: this.#progress,
      capabilities: this.#capabilities,
      profile: this.#profile,
      playerId: this.#id,
      problems: this.#problemManager.problems(),
      activeData,
      urlState: {
        sourceId: this.#sourceId,
        parameters: this.#urlParams,
      },
    };

    await this.#listener(data);
  }

  /**
   * Run one tick loop by reading from the message iterator a "tick" worth of messages.
   * */
  async #tick(): Promise<void> {
    if (!this.#isPlaying) {
      return;
    }
    if (!this.#start || !this.#end) {
      throw new Error("Invariant: start & end should be set before tick()");
    }

    // compute how long of a time range we want to read by taking into account
    // the time since our last read and how fast we're currently playing back
    const tickTime = performance.now();
    const durationMillis =
      this.#lastTickMillis != undefined && this.#lastTickMillis !== 0
        ? tickTime - this.#lastTickMillis
        : 20;
    this.#lastTickMillis = tickTime;

    // Read at most 300ms worth of messages, otherwise things can get out of control if rendering
    // is very slow. Also, smooth over the range that we request, so that a single slow frame won't
    // cause the next frame to also be unnecessarily slow by increasing the frame size.
    let rangeMillis = Math.min(durationMillis * this.#speed, 300);
    if (this.#lastRangeMillis != undefined) {
      rangeMillis = this.#lastRangeMillis * 0.9 + rangeMillis * 0.1;
    }
    this.#lastRangeMillis = rangeMillis;

    if (!this.#currentTime) {
      throw new Error("Invariant: Tried to play with no current time.");
    }

    // The end time when we want to stop reading messages and emit state for the tick
    // The end time is inclusive.
    const targetTime = add(this.#currentTime, fromMillis(rangeMillis));
    const end: Time = clampTime(targetTime, this.#start, this.#untilTime ?? this.#end);

    // If a lastStamp is available from the previous tick we check the stamp against our current
    // tick's end time. If this stamp is after our current tick's end time then we don't need to
    // read any messages and can shortcut the rest of the logic to set the current time to the tick
    // end time and queue an emit.
    //
    // If we have a lastStamp but it isn't after the tick end, then we clear it and proceed with the
    // tick logic.
    if (this.#lastStamp) {
      if (compare(this.#lastStamp, end) >= 0) {
        // Wait for the previous render frame to finish
        await this.#queueEmitState.currentPromise;

        this.#currentTime = end;
        this.#messages = [];
        this.#queueEmitState();

        if (this.#untilTime && compare(this.#currentTime, this.#untilTime) >= 0) {
          this.pausePlayback();
        }
        return;
      }

      this.#lastStamp = undefined;
    }

    const msgEvents: MessageEvent[] = [];

    // When ending the previous tick, we might have already read a message from the iterator which
    // belongs to our tick. This logic brings that message into our current batch of message events.
    if (this.#lastMessageEvent) {
      // If the last message we saw is still ahead of the tick end time, we don't emit anything
      if (compare(this.#lastMessageEvent.receiveTime, end) > 0) {
        // Wait for the previous render frame to finish
        await this.#queueEmitState.currentPromise;

        this.#currentTime = end;
        this.#messages = msgEvents;
        this.#queueEmitState();

        if (this.#untilTime && compare(this.#currentTime, this.#untilTime) >= 0) {
          this.pausePlayback();
        }
        return;
      }

      msgEvents.push(this.#lastMessageEvent);
      this.#lastMessageEvent = undefined;
    }

    // If we take too long to read the tick data, we set the player into a BUFFERING presence. This
    // indicates that the player is waiting to load more data. When the tick finally finishes, we
    // clear this timeout.
    const tickTimeout = setTimeout(() => {
      this.#presence = PlayerPresence.BUFFERING;
      this.#queueEmitState();
    }, 500);

    try {
      // Read from the iterator through the end of the tick time
      for (;;) {
        if (!this.#playbackIterator) {
          throw new Error("Invariant. this._playbackIterator is undefined.");
        }

        const result = await this.#playbackIterator.next();
        if (result.done === true || this.#nextState) {
          break;
        }
        const iterResult = result.value;

        if (iterResult.type === "problem") {
          this.#problemManager.addProblem(`connid-${iterResult.connectionId}`, iterResult.problem);
          continue;
        }

        if (iterResult.type === "stamp" && compare(iterResult.stamp, end) >= 0) {
          this.#lastStamp = iterResult.stamp;
          break;
        }

        if (iterResult.type === "message-event") {
          // The message is past the tick end time, we need to save it for next tick
          if (compare(iterResult.msgEvent.receiveTime, end) > 0) {
            this.#lastMessageEvent = iterResult.msgEvent;
            break;
          }

          msgEvents.push(iterResult.msgEvent);
        }
      }
    } finally {
      clearTimeout(tickTimeout);
    }

    // Set the presence back to PRESENT since we are no longer buffering
    this.#presence = PlayerPresence.PRESENT;

    if (this.#nextState) {
      return;
    }

    // Wait on any active emit state to finish as part of this tick
    // Without waiting on the emit state to finish we might drop messages since our emitState
    // might get debounced
    await this.#queueEmitState.currentPromise;

    this.#currentTime = end;
    this.#messages = msgEvents;
    this.#queueEmitState();

    // This tick has reached the end of the untilTime so we go back to pause
    if (this.#untilTime && compare(this.#currentTime, this.#untilTime) >= 0) {
      this.pausePlayback();
    }
  }

  async #stateIdle() {
    assert(this.#abort == undefined, "Invariant: some other abort controller exists");

    this.#isPlaying = false;
    this.#presence = PlayerPresence.PRESENT;

    // set the latest value of the loaded ranges for the next emit state
    this.#progress = {
      fullyLoadedFractionRanges: this.#bufferedSource.loadedRanges(),
      messageCache: this.#progress.messageCache,
    };

    const abort = (this.#abort = new AbortController());
    const aborted = new Promise((resolve) => {
      abort.signal.addEventListener("abort", resolve);
    });

    const rangeChangeHandler = () => {
      this.#progress = {
        fullyLoadedFractionRanges: this.#bufferedSource.loadedRanges(),
        messageCache: this.#progress.messageCache,
        memoryInfo: {
          ...this.#progress.memoryInfo,
          [MEMORY_INFO_BUFFERED_MSGS]: this.#bufferedSource.getCacheSize(),
        },
      };
      this.#queueEmitState();
    };

    // While idle, the buffered source might still be loading and we still want to update downstream
    // with the new ranges we've buffered. This event will update progress and queue state emits
    this.#bufferedSource.on("loadedRangesChange", rangeChangeHandler);

    this.#queueEmitState();
    await aborted;
    this.#bufferedSource.off("loadedRangesChange", rangeChangeHandler);
  }

  async #statePlay() {
    this.#presence = PlayerPresence.PRESENT;

    if (!this.#currentTime) {
      throw new Error("Invariant: currentTime not set before statePlay");
    }
    if (!this.#start || !this.#end) {
      throw new Error("Invariant: start & end should be set before statePlay");
    }

    // Track the identity of allTopics, if this changes we need to reset our iterator to
    // get new messages for new topics
    const allTopics = this.#allTopics;

    try {
      while (this.#isPlaying && !this.#hasError && !this.#nextState) {
        if (compare(this.#currentTime, this.#end) >= 0) {
          // Playback has ended. Reset internal trackers for maintaining the playback speed.
          this.#lastTickMillis = undefined;
          this.#lastRangeMillis = undefined;
          this.#lastStamp = undefined;
          this.#setState("idle");
          return;
        }

        const start = Date.now();

        await this.#tick();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
        if (this.#nextState) {
          return;
        }

        // Update with the latest loaded ranges from the buffered source
        // The messageCache is updated separately by block loader events
        this.#progress = {
          fullyLoadedFractionRanges: this.#bufferedSource.loadedRanges(),
          messageCache: this.#progress.messageCache,
          memoryInfo: {
            ...this.#progress.memoryInfo,
            [MEMORY_INFO_BUFFERED_MSGS]: this.#bufferedSource.getCacheSize(),
          },
        };

        // If subscriptions changed, update to the new subscriptions
        if (this.#allTopics !== allTopics) {
          // Discard any last message event since the new iterator will repeat it
          this.#lastMessageEvent = undefined;

          // Bail playback and reset the playback iterator when topics have changed so we can load
          // the new topics
          this.#setState("reset-playback-iterator");
          return;
        }

        const time = Date.now() - start;
        // make sure we've slept at least 16 millis or so (aprox 1 frame)
        // to give the UI some time to breathe and not burn in a tight loop
        if (time < 16) {
          await delay(16 - time);
        }
      }
    } catch (err) {
      this.#setError((err as Error).message, err);
      this.#queueEmitState();
    }
  }

  async #stateClose() {
    this.#isPlaying = false;
    this.#metricsCollector.close();
    await this.#blockLoader?.stopLoading();
    await this.#blockLoadingProcess;
    await this.#bufferedSource.stopProducer();
    await this.#bufferedSource.terminate();
    await this.#playbackIterator?.return?.();
    this.#playbackIterator = undefined;
    await this.#iterableSource.terminate?.();
    this.#resolveIsClosed();
  }

  async #startBlockLoading() {
    await this.#blockLoader?.startLoading({
      progress: async (progress) => {
        this.#progress = {
          fullyLoadedFractionRanges: this.#progress.fullyLoadedFractionRanges,
          messageCache: progress.messageCache,
          memoryInfo: {
            ...this.#progress.memoryInfo,
            ...progress.memoryInfo,
          },
        };
        // If we are in playback, we will let playback queue state updates
        if (this.#state === "play") {
          return;
        }

        this.#queueEmitState();
      },
    });
  }
}
