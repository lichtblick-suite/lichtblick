// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@lichtblick/rostime";
import { Immutable, MessageEvent, Metadata } from "@lichtblick/suite";
import {
  PlayerAlert,
  Topic,
  TopicSelection,
  TopicStats,
} from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

export type TopicWithDecodingInfo = Topic & {
  messageEncoding?: string;
  schemaEncoding?: string;
  schemaData?: Uint8Array;
};

export type Initialization = {
  start: Time;
  end: Time;
  topics: TopicWithDecodingInfo[];
  topicStats: Map<string, TopicStats>;
  datatypes: RosDatatypes;
  profile: string | undefined;
  name?: string;
  metadata?: ReadonlyArray<Readonly<Metadata>>;

  /** Publisher names by topic **/
  publishersByTopic: Map<string, Set<string>>;

  alerts: PlayerAlert[];
};

export type MessageIteratorArgs = {
  /** Which topics to return from the iterator */
  topics: TopicSelection;

  /**
   * The start time of the iterator (inclusive). If no start time is specified, the iterator will start
   * from the beginning of the source.
   *
   * The first message receiveTime will be >= start.
   * */
  start?: Time;

  /**
   * The end time of the iterator (inclusive). If no end time is specified, the iterator will stop
   * at the end of the source.
   *
   * The last message receiveTime will be <= end.
   * */
  end?: Time;

  /**
   * Indicate the expected way the iterator is consumed.
   *
   * Data sources may choose to change internal mechanics depending on whether the messages are
   * consumed immediate in full from the iterator or if it might be read partially.
   *
   * `full` indicates that the caller plans to read the entire iterator
   * `partial` indicates that the caller plans to read the iterator but may not read all the messages
   */
  consumptionType?: "full" | "partial";
};

/**
 * IteratorResult represents a single result from a message iterator or cursor. There are three
 * types of results.
 *
 * - message-event: the result contains a MessageEvent
 * - alert: the result contains an alert
 * - stamp: the result is a timestamp
 *
 * Note: A stamp result acts as a marker indicating that the source has reached the specified stamp.
 * The source may return stamp results to indicate to callers that it has read through some time
 * when there are no message events available to indicate the time is reached.
 */
export type IteratorResult<MessageType = unknown> =
  | {
      type: "message-event";
      msgEvent: MessageEvent<MessageType>;
    }
  | {
      type: "alert";
      /**
       * An ID representing the channel/connection where this alert came from. The app may choose
       * to display only a single alert from each connection to avoid overwhelming the user.
       */
      connectionId: number;
      alert: PlayerAlert;
    }
  | {
      type: "stamp";
      stamp: Time;
    };

export type GetBackfillMessagesArgs = {
  topics: TopicSelection;
  time: Time;

  abortSignal?: AbortSignal;
};

// IMessageCursor describes an interface for message cursors. Message cursors are a similar concept
// to javascript generators but provide a method for reading a batch of messages rather than one
// message.
//
// Motivation: When using webworkers, read calls are invoked via an RPC interface. For large
// datasets (many hundred thousand) messages, preloading the data (i.e. to plot a signal) would
// result in several hundred thousand RPC calls. The overhead of making these calls add up and
// negatively impact the preloading experience.
//
// Providing an interface which allows callers to read a batch of messages significantly (4x speedup
// on an 700k message dataset on M1 Pro) reduces the RPC call overhead.
export interface IMessageCursor<MessageType = unknown> {
  /**
   * Read the next message from the cursor. Return a result or undefined if the cursor is done
   */
  next(): Promise<IteratorResult<MessageType> | undefined>;

  /**
   * Read the next batch of messages from the cursor. Return an array of results or undefined if the cursor is done.
   *
   * @param durationMs indicate the duration (in milliseconds) for the batch to stop waiting for
   * more messages and return. This duration tracks the receive time from the first message in the
   * batch.
   */
  nextBatch(durationMs: number): Promise<IteratorResult<MessageType>[] | undefined>;

  /**
   * Read a batch of messages through end time (inclusive) or end of cursor
   *
   * return undefined when no more message remain in the cursor
   */
  readUntil(end: Time): Promise<IteratorResult<MessageType>[] | undefined>;

  /**
   * End the cursor
   *
   * Release any held resources by the cursor.
   *
   * Calls to next() and readUntil() should return `undefined` after a cursor is ended as if the
   * cursor reached the end of its messages.
   */
  end(): Promise<void>;
}

/**
 * IIterableSource specifies an interface for initializing and accessing messages using iterators.
 *
 * IIterableSources also provide a backfill method to obtain the last message available for topics.
 */
export interface IIterableSource<MessageType = unknown> {
  /**
   * Initialize the source.
   */
  initialize(): Promise<Initialization>;

  /**
   * Instantiate an IMessageIterator for the source.
   *
   * The iterator produces IteratorResults from the source. The IteratorResults should be in log
   * time order.
   *
   * Returning an AsyncIterator rather than AsyncIterable communicates that the returned iterator
   * cannot be used directly in a `for-await-of` loop. This forces the IterablePlayer implementation
   * to use the `.next()` API, rather than `for-await-of` which would implicitly call the iterator's
   * `return()` method when breaking out of the loop and prevent the iterator from being used in
   * more than one loop. This means the IIterableSource implementations can use a simple async
   * generator function, and a `finally` block to do any necessary cleanup tasks when the request
   * finishes or is canceled.
   */
  messageIterator(
    args: Immutable<MessageIteratorArgs>,
  ): AsyncIterableIterator<Readonly<IteratorResult<MessageType>>>;

  /**
   * Load the most recent messages per topic that occurred before or at the target time, if
   * available.
   */
  getBackfillMessages(
    args: Immutable<GetBackfillMessagesArgs>,
  ): Promise<MessageEvent<MessageType>[]>;

  /**
   * A source can optionally implement a cursor interface in addition to a messageIterator interface.
   *
   * A cursor interface provides methods to read messages in batches rather than one at a time.
   * This improves performance for some workflows (i.e. message reading over webworkers) by avoiding
   * individual "next" calls per message.
   */
  getMessageCursor?: (
    args: Immutable<MessageIteratorArgs> & { abort?: AbortSignal },
  ) => IMessageCursor<MessageType>;

  getStart?: () => Time | undefined;

  /**
   * Optional method a data source can implement to cleanup resources. The player will call this
   * method when the source will no longer be used.
   */
  terminate?: () => Promise<void>;
}

export type IterableSourceInitializeArgs = {
  file?: File;
  url?: string;
  files?: File[];
  urls?: string[];
  params?: Record<string, string | undefined>;

  api?: {
    baseUrl: string;
    auth?: string;
  };
};

/**
 * Interface for a raw iterable source where messages are in their serialized byte form (Uint8Arrays).
 * A raw source is well suited for workers as array buffers can be efficientely transferred to the main thread.
 */
export type ISerializedIterableSource = IIterableSource<Uint8Array> & { sourceType: "serialized" };

/**
 * Interface for a deserialized iterable source where messages are in their deserialized form (unknown).
 */
export type IDeserializedIterableSource = IIterableSource & {
  sourceType: "deserialized";
};
