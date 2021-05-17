// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { getNodeAtPath, MosaicRootActions, MosaicWindowActions } from "react-mosaic-component";
import { MosaicKey } from "react-mosaic-component/lib/types";

import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

export function getPanelTypeFromMosaic(
  mosaicWindowActions?: MosaicWindowActions,
  mosaicActions?: MosaicRootActions<MosaicKey>,
): string | undefined {
  if (!mosaicWindowActions || !mosaicActions) {
    return undefined;
  }
  const node = getNodeAtPath(mosaicActions.getRoot(), mosaicWindowActions.getPath());
  if (typeof node !== "string") {
    throw new Error(`Used getPanelTypeFromMosaic on non-leaf node: ${JSON.stringify(node)}`);
  }
  const type = getPanelTypeFromId(node);

  return type;
}
