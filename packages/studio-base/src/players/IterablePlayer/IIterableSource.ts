// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/rostime";
import { Topic, MessageEvent } from "@foxglove/studio";
import { PlayerProblem } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

export type Initalization = {
  start: Time;
  end: Time;
  topics: Topic[];
  datatypes: RosDatatypes;
  blockDurationNanos?: number;

  // Publisher names by topic
  publishersByTopic: Map<string, Set<string>>;

  problems: PlayerProblem[];
};

export type MessageIteratorArgs = {
  topics: string[];
  start?: Time;
  reverse?: boolean;
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

/**
 * IIterableSource specifies an interface initializing and accessing messages.
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
  messageIterator(args: MessageIteratorArgs): AsyncIterator<Readonly<IteratorResult>>;
}
