// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { quat } from "gl-matrix";

import { MessageEvent, Topic } from "@foxglove/studio";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { PoseStamped, TransformStamped } from "../ros";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

type Vec4 = [number, number, number, number];

const vec4ToOrientation = ([x, y, z, w]: Vec4) => ({ x, y, z, w });

GeometryMsgs_PoseStamped.parameters = { colorScheme: "dark" };
export function GeometryMsgs_PoseStamped(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/pose1", datatype: "geometry_msgs/PoseStamped" },
    { name: "/pose2", datatype: "geometry_msgs/PoseStamped" },
    { name: "/pose3", datatype: "geometry_msgs/PoseStamped" },
  ];

  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: -5, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const pose1: MessageEvent<PoseStamped> = {
    topic: "/pose1",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      pose: {
        position: { x: 2, y: 0, z: 0 },
        orientation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/PoseStamped",
    sizeInBytes: 0,
  };

  const pose2: MessageEvent<PoseStamped> = {
    topic: "/pose2",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      pose: {
        position: { x: 0, y: 3, z: 0 },
        orientation: vec4ToOrientation(
          quat.rotateZ(quat.create(), quat.create(), Math.PI / 2) as Vec4,
        ),
      },
    },
    schemaName: "geometry_msgs/PoseStamped",
    sizeInBytes: 0,
  };

  const pose3: MessageEvent<PoseStamped> = {
    topic: "/pose3",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      pose: {
        position: { x: 0, y: 2, z: 0 },
        orientation: vec4ToOrientation(
          quat.rotateZ(quat.create(), quat.create(), Math.PI / 4) as Vec4,
        ),
      },
    },
    schemaName: "geometry_msgs/PoseStamped",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/pose1": [pose1],
      "/pose2": [pose2],
      "/pose3": [pose3],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pose1": {
              visible: true,
              type: "arrow",
            },
            "/pose2": {
              visible: true,
              type: "arrow",
              arrowScale: [2, 1, 1],
              color: "rgba(0, 255, 0, 0.3)",
            },
            "/pose3": {
              visible: true,
              axisScale: Math.sqrt(8),
            },
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 15,
            perspective: false,
            phi: rad2deg(0),
            targetOffset: [-0.6, 0.5, 0],
            thetaOffset: rad2deg(0),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}
