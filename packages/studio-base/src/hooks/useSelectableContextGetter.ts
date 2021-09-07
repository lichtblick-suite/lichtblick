// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useContext } from "react";

import { SelectableContext } from "@foxglove/studio-base/util/createSelectableContext";

/**
 * useSelectableContextGetter returns a function to access the current value of the selectable context.
 *
 * A typical use for the getter is within useCallback where using the latest value from the context is
 * needed but having the callback dependencies change on every change of the value is undesired.
 *
 * @param context the selectable context to access
 * @returns a function which returns the latest context value.
 */
function useSelectableContextGetter<T>(context: SelectableContext<T>): () => T {
  // eslint-disable-next-line no-underscore-dangle
  const handle = useContext(context._ctx);
  if (!handle) {
    throw new Error(`useSelectableContextGetter used outside a corresponding <Provider />.`);
  }

  return useCallback(() => handle.currentValue(), [handle]);
}

export default useSelectableContextGetter;
