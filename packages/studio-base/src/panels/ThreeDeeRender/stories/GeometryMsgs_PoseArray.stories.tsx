// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { quat } from "gl-matrix";

import { MessageEvent, Topic } from "@foxglove/studio";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { PoseArray, TransformStamped } from "../ros";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

type Vec4 = [number, number, number, number];
const vec4ToOrientation = ([x, y, z, w]: Vec4) => ({ x, y, z, w });

GeometryMsgs_PoseArray.parameters = { colorScheme: "dark" };
export function GeometryMsgs_PoseArray(): JSX.Element {
  const topics: Topic[] = [
    { name: "/baselink_path", datatype: "geometry_msgs/PoseArray" },
    { name: "/sensor_path", datatype: "geometry_msgs/PoseArray" },
    { name: "/sensor_path2", datatype: "geometry_msgs/PoseArray" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
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
        translation: { x: 0, y: 0, z: 1 },
        rotation: vec4ToOrientation(
          quat.rotateZ(quat.create(), quat.create(), Math.PI / 2) as Vec4,
        ),
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf3: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 10, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 5, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const q = (): quat => [0, 0, 0, 1];
  const identity = q();
  const makeOrientation = (i: number) => {
    const o = quat.rotateZ(q(), identity, (Math.PI / 2) * (i / 9));
    return { x: o[0], y: o[1], z: o[2], w: o[3] };
  };

  const baseLinkPath: MessageEvent<PoseArray> = {
    topic: "/baselink_path",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      poses: [...Array(10)].map((_, i) => ({
        position: { x: 3, y: i / 4, z: 1 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "geometry_msgs/PoseArray",
    sizeInBytes: 0,
  };

  const sensorPath: MessageEvent<PoseArray> = {
    topic: "/sensor_path",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      poses: [...Array(10)].map((_, i) => ({
        position: { x: 2, y: i / 4, z: 0 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "geometry_msgs/PoseArray",
    sizeInBytes: 0,
  };

  const sensorPath2: MessageEvent<PoseArray> = {
    topic: "/sensor_path2",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      poses: [...Array(10)].map((_, i) => ({
        position: { x: -i / 4, y: 2, z: 0 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "geometry_msgs/PoseArray",
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
