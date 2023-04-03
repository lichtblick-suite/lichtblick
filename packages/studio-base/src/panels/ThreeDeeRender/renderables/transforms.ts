// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AnyFrameId, CoordinateFrame } from "../transforms";

export const MISSING_TRANSFORM = "MISSING_TRANSFORM";

export function missingTransformMessage(
  renderFrameId: AnyFrameId,
  fixedFrameId: AnyFrameId,
  srcFrameId: AnyFrameId,
): string {
  const dstFrameId = renderFrameId === srcFrameId ? fixedFrameId : renderFrameId;
  if (srcFrameId !== dstFrameId) {
    return `Missing transform from frame <${CoordinateFrame.DisplayName(
      srcFrameId,
    )}> to frame <${CoordinateFrame.DisplayName(dstFrameId)}>`;
  } else if (srcFrameId !== fixedFrameId) {
    return `Missing transform from frame <${CoordinateFrame.DisplayName(
      srcFrameId,
    )}> to fixed frame <${CoordinateFrame.DisplayName(
      fixedFrameId,
    )}> to frame <${CoordinateFrame.DisplayName(dstFrameId)}>`;
  } else {
    return `Identity transform failed for frame <${CoordinateFrame.DisplayName(srcFrameId)}>`;
  }
}
