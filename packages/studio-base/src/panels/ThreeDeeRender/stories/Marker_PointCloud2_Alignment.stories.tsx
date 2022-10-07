// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { Marker, MarkerType, PointCloud2, TransformStamped } from "../ros";
import { makeColor, QUAT_IDENTITY, rad2deg, rgba, VEC3_ZERO } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

Marker_PointCloud2_Alignment.parameters = { colorScheme: "dark" };
export function Marker_PointCloud2_Alignment(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" },
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
        translation: { x: 1.482, y: 0, z: 1.7861 },
        rotation: { x: 0.010471, y: 0.008726, z: -0.000091, w: 0.999907 },
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const points: MessageEvent<Marker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: 0,
      ns: "",
      type: MarkerType.POINTS,
      action: 0,
      frame_locked: false,
      pose: {
        position: VEC3_ZERO,
        orientation: QUAT_IDENTITY,
      },
      scale: { x: 0.017, y: 0.017, z: 0.017 },
      color: makeColor("#3f51b5", 0.25),

      points: [
        { x: 0, y: 0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
      ],
      colors: [makeColor("#f44336"), makeColor("#4caf50"), makeColor("#2196f3")],
      lifetime: { sec: 0, nsec: 0 },
      text: "",
      mesh_resource: "",
      mesh_use_embedded_materials: false,
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  function writePoint(
    view: DataView,
    i: number,
    x: number,
    y: number,
    z: number,
    colorHex: string,
  ) {
    const offset = i * 16;
    const c = makeColor(colorHex);
    view.setFloat32(offset + 0, x, true);
    view.setFloat32(offset + 4, y, true);
    view.setFloat32(offset + 8, z, true);
    view.setUint32(offset + 12, rgba(c.r, c.g, c.b, c.a), true);
  }

  const data = new Uint8Array(3 * 16);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  writePoint(view, 0, 0, 0.25, 0, "#f44336");
  writePoint(view, 1, 0.25, -0.25, 0, "#4caf50");
  writePoint(view, 2, -0.25, -0.25, 0, "#2196f3");

  const pointCloud: MessageEvent<PointCloud2> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      height: 1,
      width: 3,
      fields: [
        { name: "x", offset: 0, datatype: 7, count: 1 },
        { name: "y", offset: 4, datatype: 7, count: 1 },
        { name: "z", offset: 8, datatype: 7, count: 1 },
        { name: "rgba", offset: 12, datatype: 6, count: 1 },
      ],
      is_bigendian: false,
      point_step: 16,
      row_step: 3 * 16,
      data,
      is_dense: true,
    },
    schemaName: "sensor_msgs/PointCloud2",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/markers": [points],
      "/pointcloud": [pointCloud],
      "/tf": [tf1, tf2],
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
          ...ThreeDeeRender.defaultConfig,
          topics: {
            "/markers": { visible: true },
            "/pointcloud": {
              visible: true,
              pointSize: 30,
              colorMode: "rgba",
              colorField: "rgba",
              rgbByteOrder: "rgba",
            },
          },
          followTf: "base_link",
          cameraState: {
            distance: 4,
            perspective: true,
            phi: rad2deg(1),
            targetOffset: [-0.22, 2.07, 0],
            thetaOffset: rad2deg(-0.65),
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
