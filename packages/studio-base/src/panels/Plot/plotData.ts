// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";
import { MessageDataItemsByPath } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { PlotDataByPath } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

/**
 * Fetch the data we need from each item in itemsByPath and discard the rest of
 * the message to save memory.
 */
const getByPath = (itemsByPath: MessageDataItemsByPath): PlotDataByPath => {
  const ret: PlotDataByPath = {};
  Object.entries(itemsByPath).forEach(([path, items]) => {
    ret[path] = items.map((messageAndData) => {
      const headerStamp = getTimestampForMessage(messageAndData.messageEvent.message);
      return {
        queriedData: messageAndData.queriedData,
        receiveTime: messageAndData.messageEvent.receiveTime,
        headerStamp,
      };
    });
  });
  return ret;
};

function getMessagePathItems(
  decodeMessagePathsForMessagesByTopic: (
    Record: Record<string, readonly MessageEvent[]>,
  ) => MessageDataItemsByPath,
  messages: Record<string, readonly MessageEvent[]>,
): PlotDataByPath {
  return Object.freeze(getByPath(decodeMessagePathsForMessagesByTopic(messages)));
}

/**
 * Fetch all the plot data we want for our current subscribed topics from blocks.
 */
export function getBlockItemsByPath(
  decodeMessagePathsForMessagesByTopic: (
    msgs: Record<string, readonly MessageEvent[]>,
  ) => MessageDataItemsByPath,
  messages: Record<string, readonly MessageEvent[]>,
): PlotDataByPath {
  return getMessagePathItems(decodeMessagePathsForMessagesByTopic, messages);
}
