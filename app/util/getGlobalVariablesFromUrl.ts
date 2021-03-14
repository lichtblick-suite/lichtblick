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
import {
  GLOBAL_VARIABLES_QUERY_KEY,
  OLD_GLOBAL_VARIABLES_QUERY_KEY,
} from "@foxglove-studio/app/util/globalConstants";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

export function getGlobalVariablesFromUrl(
  params: URLSearchParams,
): Record<string, string> | undefined {
  const globalVariables =
    params.get(GLOBAL_VARIABLES_QUERY_KEY) || params.get(OLD_GLOBAL_VARIABLES_QUERY_KEY);
  if (globalVariables) {
    try {
      return JSON.parse(globalVariables);
    } catch (error) {
      sendNotification(
        `Invalid JSON for global variables (${GLOBAL_VARIABLES_QUERY_KEY})`,
        error,
        "user",
        "error",
      );
    }
  }
}
