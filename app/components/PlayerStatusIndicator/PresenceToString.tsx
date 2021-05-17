// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlayerPresence } from "@foxglove/studio-base/players/types";

export function PresenceToString(presence: PlayerPresence): string {
  switch (presence) {
    case PlayerPresence.NOT_PRESENT:
      return "Not Present";
    case PlayerPresence.PRESENT:
      return "Present";
    case PlayerPresence.CONSTRUCTING:
      return "Constructing";
    case PlayerPresence.INITIALIZING:
      return "Initializing";
    case PlayerPresence.RECONNECTING:
      return "Reconnecting";
    case PlayerPresence.ERROR:
      return "Error";
    default:
      return "";
  }
}
