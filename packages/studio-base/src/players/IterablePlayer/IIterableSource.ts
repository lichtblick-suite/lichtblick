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
      connectionId: number;
      msgEvent: MessageEvent<unknown>;
      problem: undefined;
    }
  | {
      connectionId: number;
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
   * The iterator produces IteratorResults from the source. The IteratorResults should be
   * in log time order.
   */
  messageIterator(args: MessageIteratorArgs): AsyncIterable<Readonly<IteratorResult>>;
}
