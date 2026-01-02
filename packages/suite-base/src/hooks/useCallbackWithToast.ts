// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useSnackbar } from "notistack";
import { useCallback } from "react";

import Logger from "@lichtblick/log";
import { HttpError } from "@lichtblick/suite-base/services/http/HttpError";

const log = Logger.getLogger(__filename);

/**
 * A version of React.useCallback() displaying any errors thrown from the function as toast notifications.
 * For HttpErrors, displays user-friendly messages based on status code. For other errors, shows the error message.
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
        const errorMessage =
          error instanceof HttpError
            ? error.getUserFriendlyErrorMessage()
            : (error as Error).toString();
        enqueueSnackbar(errorMessage, { variant: "error" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueueSnackbar, ...deps],
  );
}
