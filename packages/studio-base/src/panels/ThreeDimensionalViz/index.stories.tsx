// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosMsgDefinition } from "@foxglove/rosmsg";
import { MessageEvent, Topic } from "@foxglove/studio";
import useDelayedFixture from "@foxglove/studio-base/panels/ThreeDimensionalViz/stories/useDelayedFixture";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { CubeMarker, TF } from "@foxglove/studio-base/types/Messages";

import ThreeDimensionalViz from "./index";

const VEC3_ZERO = { x: 0, y: 0, z: 0 };
const QUAT_IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

export default {
  title: "panels/ThreeDimensionalViz",
  component: ThreeDimensionalViz,
};

export function Default(): JSX.Element {
  return (
    <PanelSetup>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          customBackgroundColor: "#2d7566",
        }}
      />
    </PanelSetup>
  );
}

export function CustomBackgroundColor(): JSX.Element {
  return (
    <PanelSetup>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          useThemeBackgroundColor: false,
          customBackgroundColor: "#2d7566",
        }}
      />
    </PanelSetup>
  );
}

export function TransformInterpolation(): JSX.Element {
  const datatypes = new Map<string, RosMsgDefinition>(
    Object.entries({
      "geometry_msgs/TransformStamped": {
        definitions: [
          { name: "header", type: "std_msgs/Header", isComplex: true },
          { name: "transform", type: "geometry_msgs/Transform", isComplex: true },
        ],
      },
      "visualization_msgs/Marker": {
        definitions: [
          { name: "header", type: "std_msgs/Header", isComplex: true },
          { name: "ns", type: "string" },
          { name: "id", type: "int32" },
          { name: "type", type: "int32" },
          { name: "action", type: "int32" },
          { name: "pose", type: "geometry_msgs/Pose", isComplex: true },
          { name: "scale", type: "geometry_msgs/Vector3", isComplex: true },
          { name: "color", type: "std_msgs/ColorRGBA", isComplex: true },
          { name: "lifetime", type: "duration" },
          { name: "frame_locked", type: "bool" },
          { name: "points", type: "geometry_msgs/Point", isArray: true, isComplex: true },
          { name: "colors", type: "std_msgs/ColorRGBA", isArray: true, isComplex: true },
          { name: "text", type: "string" },
          { name: "mesh_resource", type: "string" },
          { name: "mesh_use_embedded_materials", type: "bool" },
        ],
      },
      "std_msgs/Header": {
        definitions: [
          { name: "seq", type: "uint32" },
          { name: "stamp", type: "time" },
          { name: "frame_id", type: "string" },
        ],
      },
      "geometry_msgs/Transform": {
        definitions: [
          { name: "translation", type: "geometry_msgs/Vector3", isComplex: true },
          { name: "rotation", type: "geometry_msgs/Quaternion", isComplex: true },
        ],
      },
      "geometry_msgs/Vector3": {
        definitions: [
          { name: "x", type: "float64" },
          { name: "y", type: "float64" },
          { name: "z", type: "float64" },
        ],
      },
      "geometry_msgs/Quaternion": {
        definitions: [
          { name: "x", type: "float64" },
          { name: "y", type: "float64" },
          { name: "z", type: "float64" },
          { name: "w", type: "float64" },
        ],
      },
      "std_msgs/ColorRGBA": {
        definitions: [
          { name: "r", type: "float32" },
          { name: "g", type: "float32" },
          { name: "b", type: "float32" },
          { name: "a", type: "float32" },
        ],
      },
    }),
  );
  const topics: Topic[] = [
    { name: "/markers", datatype: "visualization_msgs/Marker" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
  ];
  const tf_t1: MessageEvent<TF> = {
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
    sizeInBytes: 0,
  };
  const tf_t3: MessageEvent<TF> = {
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
    sizeInBytes: 0,
  };
  const cube1: MessageEvent<CubeMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 1, nsec: 0 }, frame_id: "base_link" },
      id: 1,
      ns: "",
      type: 1,
      action: 0,
      frame_locked: false,
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: { r: 1, g: 0, b: 0, a: 0.25 },
      lifetime: { sec: 0, nsec: 0 },
    },
    sizeInBytes: 0,
  };
  const cube2: MessageEvent<CubeMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 1, nsec: 0 }, frame_id: "base_link" },
      id: 2,
      ns: "",
      type: 1,
      action: 0,
      frame_locked: true,
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: { r: 0, g: 1, b: 0, a: 0.25 },
      lifetime: { sec: 0, nsec: 0 },
    },
    sizeInBytes: 0,
  };
  const cube3: MessageEvent<CubeMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 2, nsec: 0 }, frame_id: "base_link" },
      id: 3,
      ns: "",
      type: 1,
      action: 0,
      frame_locked: false,
      pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: { r: 0, g: 0, b: 1, a: 0.25 },
      lifetime: { sec: 0, nsec: 0 },
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/markers": [cube1, cube2, cube3],
      "/tf": [tf_t1, tf_t3],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 2, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/tf", "t:/markers", "ns:/tf:base_link", "ns:/tf:map"],
          expandedKeys: ["name:Topics", "t:/tf", "t:/markers", "ns:/tf:base_link", "ns:/tf:map"],
          followTf: "base_link",
          modifiedNamespaceTopics: ["/tf"],
          cameraState: {
            distance: 3,
            perspective: true,
            phi: 1,
            targetOffset: [0, 0, 0],
            thetaOffset: 0,
            fovy: 0.75,
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

TransformInterpolation.parameters = { colorScheme: "dark" };
