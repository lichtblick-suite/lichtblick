// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { quat } from "gl-matrix";

import { FrameTransform, PosesInFrame } from "@foxglove/schemas";
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

Foxglove_PosesInFrame.parameters = { colorScheme: "dark" };
export function Foxglove_PosesInFrame(): JSX.Element {
  const topics: Topic[] = [
    { name: "/baselink_path", datatype: "foxglove.PosesInFrame" },
    { name: "/sensor_path", datatype: "foxglove.PosesInFrame" },
    { name: "/sensor_path2", datatype: "foxglove.PosesInFrame" },
    { name: "/tf", datatype: "foxglove.FrameTransform" },
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
      translation: { x: 0, y: 0, z: 1 },
      rotation: vec4ToOrientation(quat.rotateZ(quat.create(), quat.create(), Math.PI / 2) as Vec4),
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };
  const tf3: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 10, nsec: 0 },
      parent_frame_id: "base_link",
      child_frame_id: "sensor",
      translation: { x: 0, y: 5, z: 1 },
      rotation: QUAT_IDENTITY,
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };

  const q = (): quat => [0, 0, 0, 1];
  const identity = q();
  const makeOrientation = (i: number) => {
    const o = quat.rotateZ(q(), identity, (Math.PI / 2) * (i / 9));
    return { x: o[0], y: o[1], z: o[2], w: o[3] };
  };

  const baseLinkPath: MessageEvent<PosesInFrame> = {
    topic: "/baselink_path",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "base_link",
      poses: [...Array(10)].map((_, i) => ({
        position: { x: 3, y: i / 4, z: 1 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "foxglove.PosesInFrame",
    sizeInBytes: 0,
  };

  const sensorPath: MessageEvent<PosesInFrame> = {
    topic: "/sensor_path",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      poses: [...Array(10)].map((_, i) => ({
        position: { x: 2, y: i / 4, z: 0 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "foxglove.PosesInFrame",
    sizeInBytes: 0,
  };

  const sensorPath2: MessageEvent<PosesInFrame> = {
    topic: "/sensor_path2",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      poses: [...Array(10)].map((_, i) => ({
        position: { x: -i / 4, y: 2, z: 0 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "foxglove.PosesInFrame",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/baselink_path": [baseLinkPath],
      "/sensor_path": [sensorPath],
      "/sensor_path2": [sensorPath2],
      "/tf": [tf1, tf2, tf3],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 3, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/sensor_path": {
              visible: true,
              type: "arrow",
              gradient: ["rgba(0, 255, 0, 0.2)", "rgba(0, 255, 127, 1.0)"],
              arrowScale: [1, 0.5, 0.01],
            },
            "/sensor_path2": {
              visible: true,
              axisScale: 0.5,
            },
            "/baselink_path": {
              visible: true,
              type: "arrow",
            },
          },
          cameraState: {
            distance: 15,
            perspective: true,
            phi: rad2deg(0.25),
            targetOffset: [0, 2, 0],
            thetaOffset: rad2deg(-0.25),
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
