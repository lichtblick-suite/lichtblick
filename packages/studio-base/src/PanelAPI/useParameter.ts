// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import { ParameterValue } from "@foxglove/studio";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";

export default function useParameter<T extends ParameterValue>(
  key: string,
): [T | undefined, (value: T) => void] {
  const value = useMessagePipeline(
    useCallback((context) => context.playerState.activeData?.parameters?.get(key), [key]),
  );
  const setParameter = useMessagePipeline(useCallback((context) => context.setParameter, []));
  const setValue = useCallback(
    (newValue: T) => {
      setParameter(key, newValue);
    },
    [key, setParameter],
  );
  return [value as T | undefined, setValue];
}
