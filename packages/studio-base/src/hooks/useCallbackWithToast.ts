// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useSnackbar } from "notistack";
import { useCallback } from "react";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

/**
 * A version of React.useCallback() displaying any errors thrown from the function as toast notifications.
 */
export default function useCallbackWithToast<Args extends unknown[]>(
  callback: (...args: Args) => Promise<void> | void,
  deps: unknown[],
): (...args: Args) => Promise<void> {
  const { enqueueSnackbar } = useSnackbar();
  return useCallback(
    async (...args: Args) => {
      try {
        return await callback(...args);
      } catch (error) {
        log.error(error);
        enqueueSnackbar((error as Error).toString(), { variant: "error" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueueSnackbar, ...deps],
  );
}
