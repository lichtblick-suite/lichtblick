// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { PlayerProblem, Topic, TopicStats } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

export type Initalization = {
  start: Time;
  end: Time;
  topics: Topic[];
  topicStats: Map<string, TopicStats>;
  datatypes: RosDatatypes;
  profile: string | undefined;
  name?: string;

  /** Publisher names by topic **/
  publishersByTopic: Map<string, Set<string>>;

  problems: PlayerProblem[];
};

export type MessageIteratorArgs = {
  /** Which topics to return from the iterator */
  topics: string[];

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
 * - problem: the result contains a problem
 * - stamp: the result is a timestamp
 *
 * Note: A stamp result acts as a marker indicating that the source has reached the specified stamp.
 * The source may return stamp results to indicate to callers that it has read through some time
 * when there are no message events available to indicate the time is reached.
 */
export type IteratorResult =
  | {
      type: "message-event";
      connectionId?: number;
      msgEvent: MessageEvent;
    }
  | {
      type: "problem";
      connectionId?: number;
      problem: PlayerProblem;
    }
  | {
      type: "stamp";
      stamp: Time;
    };

export type GetBackfillMessagesArgs = {
  topics: string[];
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
export interface IMessageCursor {
  /**
   * Read the next message from the cursor. Return a result or undefined if the cursor is done
   */
  next(): Promise<IteratorResult | undefined>;

  /**
   * Read the next batch of messages from the cursor. Return an array of results or undefined if the cursor is done.
   *
   * @param durationMs indicate the duration (in milliseconds) for the batch to stop waiting for
   * more messages and return. This duration tracks the receive time from the first message in the
   * batch.
   */
  nextBatch(durationMs: number): Promise<IteratorResult[] | undefined>;

  /**
   * Read a batch of messages through end time (inclusive) or end of cursor
   *
   * return undefined when no more message remain in the cursor
   */
  readUntil(end: Time): Promise<IteratorResult[] | undefined>;

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
export interface IIterableSource {
  /**
   * Initialize the source.
   */
  initialize(): Promise<Initalization>;

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
  messageIterator(args: MessageIteratorArgs): AsyncIterableIterator<Readonly<IteratorResult>>;

  /**
   * Load the most recent messages per topic that occurred before or at the target time, if
   * available.
   */
  getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent[]>;

  /**
   * A source can optionally implement a cursor interface in addition to a messageIterator interface.
   *
   * A cursor interface provides methods to read messages in batches rather than one at a time.
   * This improves performance for some workflows (i.e. message reading over webworkers) by avoiding
   * individual "next" calls per message.
   */
  getMessageCursor?: (args: MessageIteratorArgs & { abort?: AbortSignal }) => IMessageCursor;

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
  params?: Record<string, string | undefined>;

  api?: {
    baseUrl: string;
    auth?: string;
  };
};
