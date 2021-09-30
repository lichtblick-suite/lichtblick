// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { areEqual, Time } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";

/**
 * Given a stream of chunks of messages, track the changes in receiveTime and re-arrange the chunks
 * so we can be certain each range is completely loaded when we add it to the cache.
 *
 * Assumes the incoming messages are in sorted order.
 */
export default async function* collateMessageStream(
  messageStream: Iterable<MessageEvent<unknown>[]> | AsyncIterable<MessageEvent<unknown>[]>,
  totalRange: { start: Time; end: Time },
): AsyncIterable<{ messages: MessageEvent<unknown>[]; range: { start: Time; end: Time } }> {
  let unsentStartTime = totalRange.start;
  let unsentMessages: MessageEvent<unknown>[] = [];

  for await (const messages of messageStream) {
    if (messages.length === 0) {
      continue;
    }
    let indexToKeep = messages.length - 1;
    const receiveTimeToKeep = messages[indexToKeep]!.receiveTime;
    while (indexToKeep > 0 && areEqual(messages[indexToKeep - 1]!.receiveTime, receiveTimeToKeep)) {
      indexToKeep--;
    }
    if (
      indexToKeep === 0 &&
      (unsentMessages.length === 0 ||
        areEqual(receiveTimeToKeep, unsentMessages[unsentMessages.length - 1]!.receiveTime))
    ) {
      unsentMessages.push(...messages);
    } else {
      unsentMessages.push(...messages.slice(0, indexToKeep));
      yield {
        messages: unsentMessages,
        range: { start: unsentStartTime, end: receiveTimeToKeep },
      };
      unsentStartTime = receiveTimeToKeep;
      unsentMessages = messages.slice(indexToKeep);
    }
  }
  yield {
    messages: unsentMessages,
    range: { start: unsentStartTime, end: totalRange.end },
  };
}
