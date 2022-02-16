// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import {
  getSynchronizingReducers,
  ReducedValue,
} from "@foxglove/studio-base/util/synchronizeMessages";

export function useOptionallySynchronizedMessages(
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  shouldSynchronize: boolean,
  topics: readonly string[],
): ReducedValue {
  const memoizedTopics = useDeepMemo(topics);
  const reducers = useMemo(
    () =>
      shouldSynchronize
        ? getSynchronizingReducers(memoizedTopics)
        : {
            restore: (previousValue) => ({
              messagesByTopic: previousValue ? previousValue.messagesByTopic : {},
              synchronizedMessages: undefined,
            }),
            addMessage: ({ messagesByTopic }, newMessage) => ({
              messagesByTopic: { ...messagesByTopic, [newMessage.topic]: [newMessage] },
              synchronizedMessages: undefined,
            }),
          },
    [shouldSynchronize, memoizedTopics],
  );
  return useMessageReducer({
    topics,
    ...reducers,
  });
}
