// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ConflictType } from "@foxglove/studio-base/services/ILayoutStorage";

function conflictTypeToString(conflictType: ConflictType): string;
function conflictTypeToString(conflictType: ConflictType | undefined): string | undefined;
function conflictTypeToString(conflictType: ConflictType | undefined): string | undefined {
  if (conflictType == undefined) {
    return undefined;
  }
  switch (conflictType) {
    case "both-update":
      return "Someone else also updated this layout.";
    case "local-delete-remote-update":
      return "You deleted this layout but it has been updated on the server.";
    case "local-update-remote-delete":
      return "You deleted this layout but someone else updated it.";
    case "name-collision":
      return "A layout with this name already exists.";
  }
}
export default conflictTypeToString;
