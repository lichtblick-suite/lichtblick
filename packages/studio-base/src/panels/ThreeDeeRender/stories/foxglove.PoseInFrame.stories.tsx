// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { quat } from "gl-matrix";

import { FrameTransform, PoseInFrame } from "@foxglove/schemas";
import { MessageEvent, Topic } from "@foxglove/studio";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

type Vec4 = [number, number, number, number];

const vec4ToOrientation = ([x, y, z, w]: Vec4) => ({ x, y, z, w });

Foxglove_PoseInFrame.parameters = { colorScheme: "dark" };
export function Foxglove_PoseInFrame(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "foxglove.FrameTransform" },
    { name: "/pose1", datatype: "foxglove.PoseInFrame" },
    { name: "/pose2", datatype: "foxglove.PoseInFrame" },
    { name: "/pose3", datatype: "foxglove.PoseInFrame" },
  ];

  const tf1: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "map",
      child_frame_id: "base_link",
      translation: { x: 1e7, y: 0, z: 0 },
      rotation: QUAT_IDENTITY,
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "base_link",
      child_frame_id: "sensor",
      translation: { x: 0, y: -5, z: 0 },
      rotation: QUAT_IDENTITY,
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };

  const pose1: MessageEvent<PoseInFrame> = {
    topic: "/pose1",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "base_link",
      pose: {
        position: { x: 2, y: 0, z: 0 },
        orientation: QUAT_IDENTITY,
      },
    },
    schemaName: "foxglove.PoseInFrame",
    sizeInBytes: 0,
  };

  const pose2: MessageEvent<PoseInFrame> = {
    topic: "/pose2",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: {
        position: { x: 0, y: 3, z: 0 },
        orientation: vec4ToOrientation(
          quat.rotateZ(quat.create(), quat.create(), Math.PI / 2) as Vec4,
        ),
      },
    },
    schemaName: "foxglove.PoseInFrame",
    sizeInBytes: 0,
  };

  const pose3: MessageEvent<PoseInFrame> = {
    topic: "/pose3",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "base_link",
      pose: {
        position: { x: 0, y: 2, z: 0 },
        orientation: vec4ToOrientation(
          quat.rotateZ(quat.create(), quat.create(), Math.PI / 4) as Vec4,
        ),
      },
    },
    schemaName: "foxglove.PoseInFrame",
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
