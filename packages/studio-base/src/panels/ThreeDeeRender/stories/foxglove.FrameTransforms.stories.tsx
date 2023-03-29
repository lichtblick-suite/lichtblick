// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec } from "@foxglove/rostime";
import type { FrameTransforms } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { makePass, QUAT_IDENTITY, rad2deg, TEST_COLORS } from "./common";
import useDelayedFixture from "./useDelayedFixture";
import { ThreeDeePanel } from "../index";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeePanel,
};

FoxgloveFrameTransforms.parameters = { colorScheme: "dark" };
export function FoxgloveFrameTransforms(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/tf", schemaName: "foxglove.FrameTransforms" },
  ];
  const tf_t1: MessageEvent<FrameTransforms> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    schemaName: "foxglove.FrameTransforms",
    message: {
      transforms: [
        {
          timestamp: { sec: 1, nsec: 0 },
          parent_frame_id: "base_link",
          child_frame_id: "sensor_1",
          translation: { x: 1, y: 0, z: 0 },
          rotation: QUAT_IDENTITY,
        },
        {
          timestamp: { sec: 2, nsec: 0 },
          parent_frame_id: "base_link",
          child_frame_id: "sensor_2",
          translation: { x: 2, y: 0, z: 0 },
          rotation: QUAT_IDENTITY,
        },
        {
          timestamp: { sec: 3, nsec: 0 },
          parent_frame_id: "base_link",
          child_frame_id: "sensor_3",
          translation: { x: 3, y: 0, z: 0 },
          rotation: QUAT_IDENTITY,
        },
      ],
    },
    sizeInBytes: 0,
  };
  const pass1 = makePass({
    id: 1,
    frame_id: "sensor_1",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_GREEN1,
    pose: { position: { x: 0, y: 1, z: 0 }, orientation: QUAT_IDENTITY },
  });
  const pass2 = makePass({
    id: 2,
    frame_id: "sensor_2",
    stamp: fromSec(2),
    colorHex: TEST_COLORS.MARKER_GREEN2,
    frame_locked: true,
    pose: { position: { x: 0, y: 2, z: 0 }, orientation: QUAT_IDENTITY },
  });
  const pass3 = makePass({
    id: 3,
    frame_id: "sensor_3",
    stamp: fromSec(3),
    colorHex: TEST_COLORS.MARKER_GREEN3,
    pose: { position: { x: 0, y: 3, z: 0 }, orientation: QUAT_IDENTITY },
  });

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/markers": [pass1, pass2, pass3],
      "/tf": [tf_t1],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 2, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeePanel
        overrideConfig={{
          followTf: "sensor_1",
          layers: {
            grid: {
              layerId: "foxglove.Grid",
              position: [0, 0, -0.25],
            },
          },
          cameraState: {
            distance: 5,
            perspective: true,
            phi: rad2deg(0.7),
            targetOffset: [0, 0.5, 0],
            thetaOffset: rad2deg(Math.PI / 3),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/markers": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}
