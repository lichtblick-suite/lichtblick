// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { MarkOptional } from "ts-essentials";

import { migrateLegacyToNew3DPanels } from "./migrateLegacyToNew3DPanels";
import { migrateLegacyToNewImagePanels } from "./migrateLegacyToNewImagePanels";

/**
 * Perform any necessary migrations on old layout data.
 */
export function migratePanelsState(data: MarkOptional<LayoutData, "configById">): LayoutData {
  let result: LayoutData = { ...data, configById: data.configById ?? data.savedProps ?? {} };
  delete result.savedProps;

  result = migrateLegacyToNew3DPanels(result);
  result = migrateLegacyToNewImagePanels(result);

  return result;
}
