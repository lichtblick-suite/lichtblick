// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useSnackbar } from "notistack";
import { useCallback } from "react";

import Logger from "@lichtblick/log";

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
        await callback(...args);
        return;
      } catch (error) {
        log.error(error);
        enqueueSnackbar((error as Error).toString(), { variant: "error" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueueSnackbar, ...deps],
  );
}
