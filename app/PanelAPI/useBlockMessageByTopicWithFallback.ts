// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useCallback, useMemo, useRef } from "react";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import { blockMessageCache } from "@foxglove-studio/app/PanelAPI/useBlocksByTopic";
import useChangeDetector from "@foxglove-studio/app/hooks/useChangeDetector";

function usePlaybackMessage<T>(topic: string): T | undefined {
  // DANGER! We circumvent PanelAPI.useMessageReducer's system of keeping state here.
  // We should rarely do that, since it's error-prone to implement your own
  // state management in panels. However, in this case it's really annoying that
  // the message gets reset to the default whenever a seek happens. (This is a more general
  // problem with static/latched topics that we should fix, possibly orthogonally to the
  // use of block message storage.)
  const lastMessage = useRef<T | undefined>();

  const { playerId } = PanelAPI.useDataSourceInfo();
  const hasChangedPlayerId = useChangeDetector([playerId], false);
  if (hasChangedPlayerId) {
    lastMessage.current = undefined;
  }

  const newMessage = PanelAPI.useMessageReducer<T | undefined>({
    topics: [topic],
    restore: useCallback((prevState) => prevState || lastMessage.current, [lastMessage]),
    addMessage: useCallback((prevState, { message }) => prevState || message, []),
    preloadingFallback: true,
  });
  lastMessage.current = newMessage;
  return lastMessage.current;
}

export default function useBlockMessageByTopicWithFallback<T>(topic: string): T | undefined {
  const { blocks, messageReadersByTopic } = PanelAPI.useBlocksByTopic([topic]);

  const binaryBlocksMessage = useMemo(() => {
    if (!messageReadersByTopic[topic]) {
      return;
    }
    const maybeBlockWithMessage = blocks.find((block) => block[topic]?.length);
    return maybeBlockWithMessage?.[topic]?.[0];
  }, [blocks, messageReadersByTopic, topic]);

  const parsedBlockMessage =
    binaryBlocksMessage &&
    blockMessageCache.parseMessages([binaryBlocksMessage], messageReadersByTopic)[0]?.message;

  // Not all players provide blocks, so have a playback fallback.
  // TODO(steel/jp): Neither subscription should request eagerly-parsed binary messages once
  // we have an option for that.
  const playbackMessage = usePlaybackMessage(topic);
  // @ts-expect-error once the type definitions are fixed these will no longer be unknown
  return parsedBlockMessage ?? playbackMessage;
}
