// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useMemo } from "react";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import { getTopicsFromPaths } from "@foxglove-studio/app/components/MessagePathSyntax/parseRosPath";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove-studio/app/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useShallowMemo } from "@foxglove-studio/app/util/hooks";

// Given a set of message paths, subscribe to the appropriate topics and return
// messages with their queried data decoded for each path.
export default function useMessagesByPath(
  paths: string[],
  historySize: number = Infinity,
): MessageDataItemsByPath {
  const memoizedPaths: string[] = useShallowMemo(paths);
  const subscribeTopics = useMemo(() => getTopicsFromPaths(memoizedPaths), [memoizedPaths]);

  const messagesByTopic = PanelAPI.useMessagesByTopic({
    topics: subscribeTopics,
    historySize,
  });

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(
    memoizedPaths,
  );
  return useMemo(() => decodeMessagePathsForMessagesByTopic(messagesByTopic), [
    decodeMessagePathsForMessagesByTopic,
    messagesByTopic,
  ]);
}
