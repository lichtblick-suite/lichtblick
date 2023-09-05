// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PointElement, ScriptableLineSegmentContext } from "chart.js";

type PointElementWithRawData = PointElement & {
  raw: {
    labelColor: undefined | string;
  };
};

function isPointElementWithRawData(element: PointElement): element is PointElementWithRawData {
  return "raw" in element;
}

/**
 * Returns the labelColor from the point, if available.
 */
export function lineSegmentLabelColor(context: ScriptableLineSegmentContext): undefined | string {
  if (isPointElementWithRawData(context.p0)) {
    return context.p0.raw.labelColor!;
  }
  return undefined;
}
