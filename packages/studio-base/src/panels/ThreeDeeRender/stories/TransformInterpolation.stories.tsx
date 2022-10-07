// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { TransformStamped } from "../ros";
import { makePass, QUAT_IDENTITY, rad2deg, TEST_COLORS } from "./common";
import useDelayedFixture from "./useDelayedFixture";

const VEC3_ZERO = { x: 0, y: 0, z: 0 };

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

TransformInterpolation.parameters = { colorScheme: "dark" };
export function TransformInterpolation(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf_t1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 1, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: VEC3_ZERO,
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf_t3: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 3, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 2, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const pass1 = makePass({
    id: 1,
    frame_id: "base_link",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_GREEN1,
  });
  const pass2 = makePass({
    id: 2,
    frame_id: "base_link",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_GREEN2,
    frame_locked: true,
  });
  const pass3 = makePass({
    id: 3,
    frame_id: "base_link",
    stamp: fromSec(2),
    colorHex: TEST_COLORS.MARKER_GREEN3,
    pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/markers": [pass1, pass2, pass3],
      "/tf": [tf_t1, tf_t3],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 2, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          layers: {
            grid: {
              layerId: "foxglove.Grid",
              position: [0, 0, -0.25],
            },
          },
          cameraState: {
            distance: 3,
            perspective: true,
            phi: rad2deg(1),
            targetOffset: [0, 0, 0],
            thetaOffset: rad2deg(0),
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

TransformOffsets.parameters = { colorScheme: "dark" };
export function TransformOffsets(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf_ab: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "a" },
      child_frame_id: "b",
      transform: {
        translation: { x: -1, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf_bc: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "b" },
      child_frame_id: "c",
      transform: {
        translation: { x: -1, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf_cd: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "c" },
      child_frame_id: "d",
      transform: {
        translation: { x: -1, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const pass1 = makePass({
    id: 1,
    frame_id: "d",
    stamp: fromSec(1),
    frame_locked: true,
    colorHex: TEST_COLORS.MARKER_GREEN1,
  });

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/markers": [pass1],
      "/tf": [tf_ab, tf_bc, tf_cd],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 2, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "b",
          layers: {
            grid: {
              layerId: "foxglove.Grid",
              position: [0, 0, -0.25],
              frameId: "a",
            },
          },
          scene: {
            transforms: {
              editable: true,
            },
          },
          transforms: {
            "frame:b": {
              xyzOffset: [0, 1, 0],
              rpyOffset: [45, 0, 0],
            },
            "frame:c": {
              xyzOffset: [0, 1, 0],
              rpyOffset: [-45, 0, 0],
            },
            "frame:d": {
              xyzOffset: [0, 1, 0],
            },
          },
          cameraState: {
            perspective: true,
            distance: 5,
            phi: 36,
            thetaOffset: 0,
            targetOffset: [-0.1, 0.5, 0],
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
            fovy: 45,
            near: 0.01,
            far: 5000,
          },
          topics: {
            "/markers": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}
