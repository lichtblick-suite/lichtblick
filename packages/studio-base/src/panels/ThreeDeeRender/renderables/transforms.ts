// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const MISSING_TRANSFORM = "MISSING_TRANSFORM";

export function missingTransformMessage(
  renderFrameId: string,
  fixedFrameId: string,
  srcFrameId: string,
): string {
  const dstFrameId = renderFrameId === srcFrameId ? fixedFrameId : renderFrameId;
  if (srcFrameId !== dstFrameId) {
    return `Missing transform from frame <${srcFrameId}> to frame <${dstFrameId}>`;
  } else if (srcFrameId !== fixedFrameId) {
    return `Missing transform from frame <${srcFrameId}> to fixed frame <${fixedFrameId}> to frame <${dstFrameId}>`;
  } else {
    return `Identity transform failed for frame <${srcFrameId}>`;
  }
}
