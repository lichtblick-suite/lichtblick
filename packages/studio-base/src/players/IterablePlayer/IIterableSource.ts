// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/rostime";
import { Topic, MessageEvent } from "@foxglove/studio";
import { PlayerProblem, TopicStats } from "@foxglove/studio-base/players/types";
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

export type IteratorResult =
  | {
      connectionId: number | undefined;
      msgEvent: MessageEvent<unknown>;
      problem: undefined;
    }
  | {
      connectionId: number | undefined;
      msgEvent: undefined;
      problem: PlayerProblem;
    };

export type GetBackfillMessagesArgs = {
  topics: string[];
  time: Time;

  abortSignal?: AbortSignal;
};

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
  getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]>;
}
