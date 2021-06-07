// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { noop } from "lodash";

import { ColorOverrideBySourceIdxByVariable } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/Layout";
import { Color } from "@foxglove/studio-base/types/Messages";

// Used to check if a Marker's path matches a value
// For a marker: { foo: { bar: "baz" } }
// markerKeyPath: ['foo', 'bar'] has a value of "baz"
export type MarkerPathCheck = {
  markerKeyPath?: string[];
  value?: unknown;
};

export type MarkerMatcher = {
  topic: string;

  // When set, any markers passing all the checks will have their color overridden with this color
  color?: Color;

  // MarkerMatchers "match" if ALL checks pass
  checks?: MarkerPathCheck[];
};

export const ThreeDimensionalVizContext = React.createContext<{
  setHoveredMarkerMatchers: (markerMatchers: MarkerMatcher[]) => void;

  colorOverrideBySourceIdxByVariable: ColorOverrideBySourceIdxByVariable;
  setColorOverrideBySourceIdxByVariable: (arg0: ColorOverrideBySourceIdxByVariable) => void;
}>({
  setHoveredMarkerMatchers: noop,
  colorOverrideBySourceIdxByVariable: {},
  setColorOverrideBySourceIdxByVariable: noop,
});
