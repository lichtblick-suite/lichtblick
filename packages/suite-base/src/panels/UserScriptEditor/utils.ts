// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { UserScripts } from "@lichtblick/suite-base/types/panels";

const EMPTY_USER_NODES: UserScripts = Object.freeze({});

/**
 * Filters out scripts with `mode === "hidden"` from the provided map.
 * Scripts with no mode or any mode other than "hidden" are included in the result.
 *
 * @returns A new `UserScripts` map without hidden scripts. Returns the shared empty object
 *          when the input is nullish or all scripts are hidden.
 */
export function filterVisibleUserScripts(allUserScripts: UserScripts | undefined): UserScripts {
  if (allUserScripts == null) {
    return EMPTY_USER_NODES;
  }
  const nonHidden: UserScripts = {};
  for (const [scriptId, userScript] of Object.entries(allUserScripts)) {
    if (userScript.mode == null || userScript.mode !== "hidden") {
      nonHidden[scriptId] = userScript;
    }
  }
  return Object.keys(nonHidden).length > 0 ? nonHidden : EMPTY_USER_NODES;
}
