// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { areEqual, isGreaterThan, isLessThan, Time, toString } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { Range } from "@foxglove/studio-base/util/ranges";

/** Represents a half-open time interval: [start, end) */
type TimeRange = { start: Time; end: Time };

function rangeToString(range: TimeRange) {
  return `[${toString(range.start)}, ${toString(range.end)})`;
}

function secondsBetween(minTime: Time, maxTime: Time) {
  return maxTime.sec - minTime.sec + 1e-9 * (maxTime.nsec - minTime.nsec);
}

/**
 * @returns The subarray of `messages` whose `receiveTime` is within the `requestRange`.
 */
function getMessagesFromLoadedRange(messages: MessageEvent<unknown>[], requestRange: TimeRange) {
  let startIndex, endIndex;
  {
    let lo = 0;
    let hi = messages.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const receiveTime = messages[mid]!.receiveTime;
      if (isLessThan(receiveTime, requestRange.start)) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    startIndex = lo;
  }
  {
    let lo = 0;
    let hi = messages.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const receiveTime = messages[mid]!.receiveTime;
      if (!isLessThan(receiveTime, requestRange.end)) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    endIndex = lo;
  }

  return messages.slice(startIndex, endIndex);
}

/**
 * An in-memory cache of preloaded messages over a time range.
 */
export default class MessageMemoryCache {
  private minTime: Time;
  private maxTime: Time;
  private loadedRanges: { range: TimeRange; messages: MessageEvent<unknown>[] }[] = [];

  constructor(totalRange: TimeRange) {
    this.minTime = totalRange.start;
    this.maxTime = totalRange.end;
  }

  fullyLoadedRanges(): TimeRange[] {
    return this.loadedRanges.map(({ range }) => range);
  }

  /**
   * Summarize the ranges that are fully loaded so they can be vended through the Player API and
   * displayed visually in the playback bar.
   */
  fullyLoadedFractionRanges(): Range[] {
    const totalSeconds = secondsBetween(this.minTime, this.maxTime);
    return this.loadedRanges.map(({ range }) => ({
      start: secondsBetween(this.minTime, range.start) / totalSeconds,
      end: secondsBetween(this.minTime, range.end) / totalSeconds,
    }));
  }

  /**
   * Returns the unloaded range or "gap" starting from the target time to the beginning of the next
   * loaded range, or if the target time falls inside an already-loaded range, return the next gap
   * after the target time.
   *
   * Returns undefined if the target time and all times after it have been loaded.
   */
  nextRangeToLoad(targetTime: Time): TimeRange | undefined {
    let lo = 0;
    let hi = this.loadedRanges.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const midRange = this.loadedRanges[mid]!;
      if (isGreaterThan(midRange.range.start, targetTime)) {
        hi = mid;
      } else if (!isGreaterThan(midRange.range.end, targetTime)) {
        lo = mid + 1;
      } else {
        // The target time is already loaded; return the next gap.
        if (mid + 1 < this.loadedRanges.length) {
          return {
            start: midRange.range.end,
            end: this.loadedRanges[mid + 1]!.range.start,
          };
        } else if (areEqual(midRange.range.end, this.maxTime)) {
          return undefined;
        } else {
          return { start: midRange.range.end, end: this.maxTime };
        }
      }
    }
    // The target time does not fall within a loaded range.
    if (lo < this.loadedRanges.length) {
      return { start: targetTime, end: this.loadedRanges[lo]!.range.start };
    } else if (areEqual(targetTime, this.maxTime)) {
      return undefined;
    } else {
      return { start: targetTime, end: this.maxTime };
    }
  }

  /**
   * Add `messages` to the cache. It is assumed that the given messages are the only `messages` in
   * the `coveredRange`, so the range will be considered fully cached.
   *
   * @param messages The newly loaded messages.
   * @param coveredRange The time range covered by the new messages. Must not be empty or overlap any already loaded ranges.
   */
  insert(coveredRange: TimeRange, messages: MessageEvent<unknown>[]): void {
    if (!isLessThan(coveredRange.start, coveredRange.end)) {
      throw new Error("Inserted range must not be empty");
    }
    if (
      isLessThan(coveredRange.start, this.minTime) ||
      isGreaterThan(coveredRange.end, this.maxTime)
    ) {
      throw new Error(
        `Inserting messages in ${rangeToString(
          coveredRange,
        )} which extends outside cache range ${rangeToString({
          start: this.minTime,
          end: this.maxTime,
        })}`,
      );
    }

    // Find the index at which to insert the new range, checking for any overlaps
    let insertionIdx;
    {
      let lo = 0;
      let hi = this.loadedRanges.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const midRange = this.loadedRanges[mid]!;
        if (!isLessThan(midRange.range.start, coveredRange.end)) {
          hi = mid;
        } else if (!isGreaterThan(midRange.range.end, coveredRange.start)) {
          lo = mid + 1;
        } else {
          throw new Error(
            `Inserting messages in ${rangeToString(
              coveredRange,
            )} which overlaps an existing range: ${rangeToString(midRange.range)}`,
          );
        }
      }
      insertionIdx = lo;
    }

    let spliceIdx;
    let deleteCount;
    let insertStart;
    let insertEnd;
    let insertMessages;
    const mergeBefore =
      insertionIdx > 0 &&
      areEqual(this.loadedRanges[insertionIdx - 1]!.range.end, coveredRange.start);
    const mergeAfter =
      insertionIdx < this.loadedRanges.length &&
      areEqual(this.loadedRanges[insertionIdx]!.range.start, coveredRange.end);
    if (mergeBefore && mergeAfter) {
      spliceIdx = insertionIdx - 1;
      deleteCount = 2;
      insertStart = this.loadedRanges[insertionIdx - 1]!.range.start;
      insertEnd = this.loadedRanges[insertionIdx]!.range.end;
      insertMessages = this.loadedRanges[insertionIdx - 1]!.messages.concat(
        messages,
        this.loadedRanges[insertionIdx]!.messages,
      );
    } else if (mergeBefore) {
      spliceIdx = insertionIdx - 1;
      deleteCount = 1;
      insertStart = this.loadedRanges[insertionIdx - 1]!.range.start;
      insertEnd = coveredRange.end;
      insertMessages = this.loadedRanges[insertionIdx - 1]!.messages.concat(messages);
    } else if (mergeAfter) {
      spliceIdx = insertionIdx;
      deleteCount = 1;
      insertStart = coveredRange.start;
      insertEnd = this.loadedRanges[insertionIdx]!.range.end;
      insertMessages = messages.concat(this.loadedRanges[insertionIdx]!.messages);
    } else {
      spliceIdx = insertionIdx;
      deleteCount = 0;
      insertStart = coveredRange.start;
      insertEnd = coveredRange.end;
      insertMessages = messages;
    }
    this.loadedRanges.splice(spliceIdx, deleteCount, {
      range: { start: insertStart, end: insertEnd },
      messages: insertMessages,
    });
  }

  /** Remove all messages and preloaded ranges. */
  clear(): void {
    this.loadedRanges = [];
  }

  /**
   * @returns The messages in a given range, or undefined if the range is not fully loaded.
   */
  getMessages(requestRange: TimeRange): MessageEvent<unknown>[] | undefined {
    let lo = 0;
    let hi = this.loadedRanges.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const midRange = this.loadedRanges[mid]!;
      if (!isLessThan(midRange.range.start, requestRange.end)) {
        hi = mid;
      } else if (!isGreaterThan(midRange.range.end, requestRange.start)) {
        lo = mid + 1;
      } else {
        // Since we merge ranges at insertion time, if we found any overlap, it must contain the
        // whole request range or the request is not satisfiable.
        if (
          isLessThan(requestRange.start, midRange.range.start) ||
          isGreaterThan(requestRange.end, midRange.range.end)
        ) {
          return undefined;
        }
        return getMessagesFromLoadedRange(midRange.messages, requestRange);
      }
    }
    return undefined;
  }
}
