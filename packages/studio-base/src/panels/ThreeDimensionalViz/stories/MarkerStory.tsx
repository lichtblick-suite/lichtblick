// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { cloneDeep } from "lodash";

import { Color } from "@foxglove/regl-worldview";
import {
  markerProps,
  generateMarkers,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/stories/indexUtils.stories";
import {
  FixtureExampleData,
  FixtureExample,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/stories/storyComponents";
import { ThreeDimensionalVizConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";

const fixtureData = {
  topics: {
    "/smoothed_localized_pose": {
      name: "/smoothed_localized_pose",
      datatype: "geometry_msgs/PoseStamped",
    },
    "/viz_markers": { name: "/viz_markers", datatype: "visualization_msgs/MarkerArray" },
  },
  frame: {
    "/viz_markers": [
      {
        topic: "/viz_markers",
        receiveTime: { sec: 1534827954, nsec: 199901839 },
        message: {
          markers: [] as ReturnType<typeof generateMarkers>,
        },
      },
    ],
  },
};
Object.keys(markerProps).forEach((markerType, idx) => {
  const markerProp = markerProps[markerType as keyof typeof markerProps];
  const markers = generateMarkers(markerProp, idx, markerType);
  fixtureData.frame["/viz_markers"]?.[0]?.message.markers.push(...markers);
});

// ts-prune-ignore-next
export function MarkerStory(
  props: {
    data?: FixtureExampleData;
    initialConfigOverride?: Partial<ThreeDimensionalVizConfig>;
    overrideColor?: Color;
    onMount?: (arg0?: HTMLDivElement) => void;
  } = {},
): JSX.Element {
  const { data, overrideColor, onMount, initialConfigOverride } = props;

  return (
    <FixtureExample
      onMount={onMount}
      data={data ?? cloneDeep(fixtureData)}
      initialConfig={{
        checkedKeys: ["name:(Uncategorized)", "t:/smoothed_localized_pose", "t:/viz_markers"],
        settingsByKey: { "t:/viz_markers": { overrideColor } },
        followTf: undefined,
        cameraState: {
          distance: 85,
          thetaOffset: -0.5,
          perspective: true,
        },
        colorOverrideBySourceIdxByVariable: {
          qux_idx: [{ active: true, color: { r: 1, g: 0.3, b: 0.1, a: 1 } }],
          foo: [{ active: true, color: { r: 0.2, g: 0.4, b: 1, a: 1 } }],
        },
        ...initialConfigOverride,
      }}
    />
  );
}
