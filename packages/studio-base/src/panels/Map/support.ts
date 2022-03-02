// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";

import { NavSatFixMsg, NavSatFixStatus } from "./types";

/**
 * @returns true if the message event status indicates there is a fix
 */
function hasFix(ev: MessageEvent<NavSatFixMsg>): boolean {
  switch (ev.message.status?.status) {
    case NavSatFixStatus.STATUS_GBAS_FIX:
    case NavSatFixStatus.STATUS_SBAS_FIX:
    case NavSatFixStatus.STATUS_FIX:
      return true;
    case NavSatFixStatus.STATUS_NO_FIX:
    case undefined:
    default:
      return false;
  }
}

export { hasFix };
