// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { quat } from "gl-matrix";

import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { NavPath, TransformStamped } from "../ros";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

NavMsgs_Path.parameters = { colorScheme: "dark" };
export function NavMsgs_Path(): JSX.Element {
  const topics: Topic[] = [
    { name: "/baselink_path", schemaName: "nav_msgs/Path" },
    { name: "/sensor_path", schemaName: "nav_msgs/Path" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
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
        rotation: QUAT_IDENTITY,
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
    const o = quat.rotateZ(q(), identity, Math.PI * 2 * (i / 10));
    return { x: o[0], y: o[1], z: o[2], w: o[3] };
  };

  const baseLinkPath: MessageEvent<NavPath> = {
    topic: "/baselink_path",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      poses: [...Array(10)].map((_, i) => ({
        header: {
          seq: 0,
          stamp: { sec: i, nsec: 0 },
          frame_id: i % 2 === 0 ? "base_link" : "sensor",
        },
        pose: { position: { x: i - 5, y: 0, z: 0 }, orientation: makeOrientation(i) },
      })),
    },
    schemaName: "nav_msgs/Path",
    sizeInBytes: 0,
  };

  const sensorPath: MessageEvent<NavPath> = {
    topic: "/sensor_path",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      poses: [...Array(10)].map((_, i) => ({
        header: { seq: 0, stamp: { sec: i, nsec: 0 }, frame_id: "sensor" },
        pose: { position: { x: i - 5, y: 0, z: i % 2 }, orientation: makeOrientation(i) },
      })),
    },
    schemaName: "nav_msgs/Path",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/baselink_path": [baseLinkPath],
      "/sensor_path": [sensorPath],
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
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 15,
            perspective: true,
            phi: rad2deg(1),
            targetOffset: [0, 2, 0],
            thetaOffset: rad2deg(-0.25),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/baselink_path": { visible: true },
            "/sensor_path": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}
