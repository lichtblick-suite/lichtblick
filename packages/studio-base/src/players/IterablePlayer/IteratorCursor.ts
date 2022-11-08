// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { compare } from "@foxglove/rostime";
import { Time } from "@foxglove/studio";

import type { IMessageCursor, IteratorResult } from "./IIterableSource";

/// IteratorCursor implements a IMessageCursor interface on top of an AsyncIterable
class IteratorCursor implements IMessageCursor {
  private _iter: AsyncIterableIterator<Readonly<IteratorResult>>;
  // readUntil reads from the iterator inclusive of end time. To do this, it reads from the iterator
  // until it receives a receiveTime after end time to signal it has received all the messages
  // inclusive of end time. Since iterators are read once, this last result must be stored for the
  // next readUntil call otherwise it would be lost.
  private _lastIteratorResult?: IteratorResult;
  private _abort?: AbortSignal;

  public constructor(
    iterator: AsyncIterableIterator<Readonly<IteratorResult>>,
    abort?: AbortSignal,
  ) {
    this._iter = iterator;
    this._abort = abort;
  }

  public async next(): ReturnType<IMessageCursor["next"]> {
    if (this._abort?.aborted === true) {
      return undefined;
    }

    const result = await this._iter.next();
    return result.value;
  }

  public async readUntil(end: Time): ReturnType<IMessageCursor["readUntil"]> {
    // Assign to a variable to fool typescript control flow analysis which does not understand
    // that this value could change after the _await_
    const isAborted = this._abort?.aborted;
    if (isAborted === true) {
      return undefined;
    }

    const results: IteratorResult[] = [];

    // if the last result is still past end time, return empty results
    if (
      this._lastIteratorResult?.type === "stamp" &&
      compare(this._lastIteratorResult.stamp, end) >= 0
    ) {
      return results;
    }

    if (
      this._lastIteratorResult?.type === "message-event" &&
      compare(this._lastIteratorResult.msgEvent.receiveTime, end) > 0
    ) {
      return results;
    }

    if (this._lastIteratorResult) {
      results.push(this._lastIteratorResult);
      this._lastIteratorResult = undefined;
    }

    for (;;) {
      const result = await this._iter.next();
      if (this._abort?.aborted === true) {
        return undefined;
      }

      if (result.done === true) {
        break;
      }

      const value = result.value;
      if (value.type === "stamp" && compare(value.stamp, end) >= 0) {
        this._lastIteratorResult = value;
        break;
      }
      if (value.type === "message-event" && compare(value.msgEvent.receiveTime, end) > 0) {
        this._lastIteratorResult = value;
        break;
      }
      results.push(value);
    }

    return results;
  }

  public async end(): ReturnType<IMessageCursor["end"]> {
    await this._iter.return?.();
  }
}

export { IteratorCursor };
