// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { compare, add as addTime } from "@lichtblick/rostime";
import { Time } from "@lichtblick/suite";

import type { IMessageCursor, IteratorResult } from "./IIterableSource";

const TIME_ZERO = Object.freeze({ sec: 0, nsec: 0 });

/// IteratorCursor implements a IMessageCursor interface on top of an AsyncIterable
class IteratorCursor<MessageType = unknown> implements IMessageCursor<MessageType> {
  #iter: AsyncIterableIterator<Readonly<IteratorResult<MessageType>>>;
  // readUntil reads from the iterator inclusive of end time. To do this, it reads from the iterator
  // until it receives a receiveTime after end time to signal it has received all the messages
  // inclusive of end time. Since iterators are read once, this last result must be stored for the
  // next readUntil call otherwise it would be lost.
  #lastIteratorResult?: IteratorResult<MessageType>;
  #abort?: AbortSignal;

  public constructor(
    iterator: AsyncIterableIterator<Readonly<IteratorResult<MessageType>>>,
    abort?: AbortSignal,
  ) {
    this.#iter = iterator;
    this.#abort = abort;
  }

  public async next(): ReturnType<IMessageCursor<MessageType>["next"]> {
    if (this.#abort?.aborted === true) {
      return undefined;
    }

    const result = await this.#iter.next();
    return result.value;
  }

  public async nextBatch(durationMs: number): Promise<IteratorResult<MessageType>[] | undefined> {
    const firstResult = await this.next();
    if (!firstResult) {
      return undefined;
    }

    if (firstResult.type === "alert") {
      return [firstResult];
    }

    const results: IteratorResult<MessageType>[] = [firstResult];

    let cutoffTime: Time = TIME_ZERO;
    switch (firstResult.type) {
      case "stamp":
        cutoffTime = addTime(firstResult.stamp, { sec: 0, nsec: durationMs * 1e6 });
        break;
      case "message-event":
        cutoffTime = addTime(firstResult.msgEvent.receiveTime, { sec: 0, nsec: durationMs * 1e6 });
        break;
    }

    for (;;) {
      const result = await this.next();
      if (!result) {
        return results;
      }

      results.push(result);

      if (result.type === "alert") {
        break;
      }
      if (result.type === "stamp" && compare(result.stamp, cutoffTime) > 0) {
        break;
      }
      if (result.type === "message-event" && compare(result.msgEvent.receiveTime, cutoffTime) > 0) {
        break;
      }
    }
    return results;
  }

  public async readUntil(end: Time): ReturnType<IMessageCursor<MessageType>["readUntil"]> {
    // Assign to a variable to fool typescript control flow analysis which does not understand
    // that this value could change after the _await_
    const isAborted = this.#abort?.aborted;
    if (isAborted === true) {
      return undefined;
    }

    const results: IteratorResult<MessageType>[] = [];

    // if the last result is still past end time, return empty results
    if (
      this.#lastIteratorResult?.type === "stamp" &&
      compare(this.#lastIteratorResult.stamp, end) >= 0
    ) {
      return results;
    }

    if (
      this.#lastIteratorResult?.type === "message-event" &&
      compare(this.#lastIteratorResult.msgEvent.receiveTime, end) > 0
    ) {
      return results;
    }

    if (this.#lastIteratorResult) {
      results.push(this.#lastIteratorResult);
      this.#lastIteratorResult = undefined;
    }

    for (;;) {
      const result = await this.#iter.next();
      if (this.#abort?.aborted === true) {
        return undefined;
      }

      if (result.done === true) {
        break;
      }

      const value = result.value;
      if (value.type === "stamp" && compare(value.stamp, end) >= 0) {
        this.#lastIteratorResult = value;
        break;
      }
      if (value.type === "message-event" && compare(value.msgEvent.receiveTime, end) > 0) {
        this.#lastIteratorResult = value;
        break;
      }
      results.push(value);
    }

    return results;
  }

  public async end(): ReturnType<IMessageCursor<MessageType>["end"]> {
    await this.#iter.return?.();
  }
}

export { IteratorCursor };
