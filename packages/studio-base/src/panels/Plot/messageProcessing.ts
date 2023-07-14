// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";

import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import { PlotDataByPath } from "./internalTypes";

type MessagePathDecoder = ReturnType<typeof useDecodeMessagePathsForMessagesByTopic>;

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
  decodeMessagePathsForMessagesByTopic: MessagePathDecoder,
  messages: Immutable<Record<string, MessageEvent[]>>,
): PlotDataByPath {
  return Object.freeze(getByPath(decodeMessagePathsForMessagesByTopic(messages)));
}

/**
 * Fetch all the plot data we want for our current subscribed topics from blocks.
 */
export function getBlockItemsByPath(
  decodeMessagePathsForMessagesByTopic: MessagePathDecoder,
  messages: Immutable<Record<string, MessageEvent[]>>,
): PlotDataByPath {
  return getMessagePathItems(decodeMessagePathsForMessagesByTopic, messages);
}
