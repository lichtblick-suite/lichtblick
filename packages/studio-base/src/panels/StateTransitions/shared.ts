// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StateTransitionPath } from "./types";

export const DEFAULT_PATH: StateTransitionPath = Object.freeze({
  value: "",
  timestampMethod: "receiveTime",
});

function presence<T>(value: undefined | T): undefined | T {
  if (value === "") {
    return undefined;
  }

  return value ?? undefined;
}

export function stateTransitionPathDisplayName(
  path: Readonly<StateTransitionPath>,
  fallbackMessage: string,
): string {
  return presence(path.label) ?? presence(path.value) ?? fallbackMessage;
}
