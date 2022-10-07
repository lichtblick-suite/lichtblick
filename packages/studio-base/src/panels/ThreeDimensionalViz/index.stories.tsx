// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { quat, vec3 } from "gl-matrix";
import { DeepWritable } from "ts-essentials";

import { DEFAULT_CAMERA_STATE, Vec4, vec4ToOrientation } from "@foxglove/regl-worldview";
import { RosMsgDefinition } from "@foxglove/rosmsg";
import { fromSec, Time } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import useDelayedFixture from "@foxglove/studio-base/panels/ThreeDimensionalViz/stories/useDelayedFixture";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";
import {
  ArrowMarker,
  CubeListMarker,
  CubeMarker,
  CylinderMarker,
  GeometryMsgs$PolygonStamped,
  GeometryMsgs$PoseArray,
  Header,
  LaserScan,
  LineListMarker,
  LineStripMarker,
  MeshMarker,
  NavMsgs$Path,
  Point,
  PointCloud2,
  PointsMarker,
  Pose,
  PoseStamped,
  SphereListMarker,
  SphereMarker,
  TextMarker,
  TF,
  TriangleListMarker,
} from "@foxglove/studio-base/types/Messages";
import { hexToColorObj } from "@foxglove/studio-base/util/colorUtils";
import { FOXGLOVE_GRID_TOPIC } from "@foxglove/studio-base/util/globalConstants";

import ThreeDimensionalViz from "./index";

const VEC3_ZERO = { x: 0, y: 0, z: 0 };
const VEC3_HALF = { x: 0.5, y: 0.5, z: 0.5 };
const VEC3_3_4 = { x: 0.75, y: 0.75, z: 0.75 };
const QUAT_IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

const testColors = {
  MARKER_GREEN1: "#296019",
  MARKER_GREEN2: "#65C83B",
  MARKER_GREEN3: "#B8F9AE",

  MARKER_RED1: "#910000",
  MARKER_RED2: "#D32431",
  MARKER_RED3: "#FF6B6B",
};

function makeColor(hex: string, alpha?: number) {
  return hexToColorObj(hex, alpha);
}

function rgba(r: number, g: number, b: number, a: number) {
  return (
    (Math.trunc(r * 255) << 24) |
    (Math.trunc(g * 255) << 16) |
    (Math.trunc(b * 255) << 8) |
    Math.trunc(a * 255)
  );
}

type PassFailMarker = CubeMarker;

type MarkerArgs = {
  id: number;
  stamp: Time;
  frame_id: string;
  colorHex: string;
  description?: string;
  ns?: string;
  frame_locked?: boolean;
  pose?: Pose;
  scale?: Point;
  receiveTime?: Time;
  lifetime?: Time;
};

function makePass({
  id,
  stamp,
  frame_id,
  colorHex,
  description,
  ns = "",
  frame_locked = false,
  pose = { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
  scale = VEC3_HALF,
  receiveTime = { sec: 10, nsec: 0 },
  lifetime = { sec: 0, nsec: 0 },
}: MarkerArgs): MessageEvent<PassFailMarker> {
  return {
    topic: "/markers",
    receiveTime,
    message: {
      header: { seq: 0, stamp, frame_id },
      id: `pass${id}${description ? `: ${description}` : ""}`,
      ns,
      type: 1,
      action: 0,
      frame_locked,
      pose,
      scale,
      color: makeColor(colorHex, 0.25),
      lifetime,
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };
}

function makeFail({
  id,
  stamp,
  frame_id,
  colorHex,
  description,
  ns = "",
  frame_locked = false,
  pose = { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
  scale = VEC3_3_4,
  receiveTime = { sec: 10, nsec: 0 },
  lifetime = { sec: 0, nsec: 0 },
}: MarkerArgs): MessageEvent<PassFailMarker> {
  return {
    topic: "/markers",
    receiveTime,
    message: {
      header: { seq: 0, stamp, frame_id },
      id: `fail${id}${description ? `: ${description}` : ""}`,
      ns,
      type: 1,
      action: 0,
      frame_locked,
      pose,
      scale,
      color: makeColor(colorHex, 0.75),
      lifetime,
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };
}

const datatypes = new Map<string, RosMsgDefinition>(
  Object.entries({
    "geometry_msgs/PolygonStamped": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isComplex: true },
        { name: "polygon", type: "geometry_msgs/Polygon", isComplex: true },
      ],
    },
    "geometry_msgs/TransformStamped": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isComplex: true },
        { name: "transform", type: "geometry_msgs/Transform", isComplex: true },
      ],
    },
    "sensor_msgs/LaserScan": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isComplex: true },
        { name: "angle_min", type: "float32" },
        { name: "angle_max", type: "float32" },
        { name: "angle_increment", type: "float32" },
        { name: "time_increment", type: "float32" },
        { name: "scan_time", type: "float32" },
        { name: "range_min", type: "float32" },
        { name: "range_max", type: "float32" },
        { name: "ranges", type: "float32", isArray: true },
        { name: "intensities", type: "float32", isArray: true },
      ],
    },
    "sensor_msgs/PointCloud2": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isComplex: true },
        { name: "height", type: "uint32" },
        { name: "width", type: "uint32" },
        { name: "fields", type: "sensor_msgs/PointField", isComplex: true, isArray: true },
        { name: "is_bigendian", type: "bool" },
        { name: "point_step", type: "uint32" },
        { name: "row_step", type: "uint32" },
        { name: "data", type: "uint8", isArray: true },
        { name: "is_dense", type: "bool" },
      ],
    },
    "sensor_msgs/PointField": {
      definitions: [
        { name: "name", type: "string" },
        { name: "offset", type: "uint32" },
        { name: "datatype", type: "uint8" },
        { name: "count", type: "uint32" },
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
    "geometry_msgs/Polygon": {
      definitions: [
        { name: "points", type: "geometry_msgs/Point32", isArray: true, isComplex: true },
      ],
    },
    "geometry_msgs/Transform": {
      definitions: [
        { name: "translation", type: "geometry_msgs/Vector3", isComplex: true },
        { name: "rotation", type: "geometry_msgs/Quaternion", isComplex: true },
      ],
    },
    "geometry_msgs/Point32": {
      definitions: [
        { name: "x", type: "float32" },
        { name: "y", type: "float32" },
        { name: "z", type: "float32" },
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

Markers.parameters = { colorScheme: "dark", chromatic: { delay: 100 } };
export function Markers(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
  ];

  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 1, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const arrow: MessageEvent<ArrowMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `arrow`,
      ns: "",
      type: 0,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: -2, y: 1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.1, z: 0.1 },
      color: makeColor("#f44336", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const cube: MessageEvent<CubeMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `cube`,
      ns: "",
      type: 1,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: -1, y: 1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#e81e63", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const sphere: MessageEvent<SphereMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `sphere`,
      ns: "",
      type: 2,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: 1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#9c27b0", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const cylinder: MessageEvent<CylinderMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `cylinder`,
      ns: "",
      type: 3,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 1, y: 1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#673ab7", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const lineStrip: MessageEvent<LineStripMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `lineStrip`,
      ns: "",
      type: 4,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: -2, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      color: makeColor("#3f51b5", 0.5),
      points: [
        { x: 0, y: 0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
        { x: 0, y: 0.25, z: 0 },
      ],
      colors: [
        makeColor("#f44336", 0.5),
        makeColor("#4caf50", 1),
        makeColor("#2196f3", 1),
        makeColor("#ffeb3b", 0.5),
      ],
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const lineList: MessageEvent<LineListMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `lineList`,
      ns: "",
      type: 5,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: -1, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      color: makeColor("#4caf50", 1),
      points: [
        { x: 0, y: 0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
        { x: 0, y: 0.25, z: 0 },
      ],
      colors: [
        makeColor("#f44336", 0.5),
        makeColor("#4caf50", 0.5),
        makeColor("#2196f3", 1),
        makeColor("#ffeb3b", 1),
        makeColor("#e81e63", 0.5),
        makeColor("#3f51b5", 0.5),
      ],
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const cubeList: MessageEvent<CubeListMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `cubeList`,
      ns: "",
      type: 6,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.25, y: 0.25, z: 0.25 },
      color: makeColor("#ffc107", 0.25),
      points: [
        { x: 0, y: 0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
      ],
      colors: [makeColor("#f44336", 0.5), makeColor("#4caf50", 0.5), makeColor("#2196f3", 0.5)],
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const sphereList: MessageEvent<SphereListMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `sphereList`,
      ns: "",
      type: 7,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 1, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.25, y: 0.25, z: 0.25 },
      color: makeColor("#f44336", 0.25),
      points: [
        { x: 0, y: 0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
      ],
      colors: [makeColor("#f44336", 0.5), makeColor("#4caf50", 0.5), makeColor("#2196f3", 0.5)],
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const points: MessageEvent<PointsMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `points`,
      ns: "",
      type: 8,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: -2, y: -1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.25, y: 0.25, z: 0.25 },
      color: makeColor("#3f51b5", 0.25),

      points: [
        { x: 0, y: 0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
      ],
      colors: [makeColor("#f44336", 0.5), makeColor("#4caf50", 0.5), makeColor("#2196f3", 0.5)],
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const text: MessageEvent<TextMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `text`,
      ns: "",
      type: 9,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: -1, y: -1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 1, y: 1, z: 1 },
      color: makeColor("#4caf50", 0.5),
      text: "Lorem Ipsum\nDolor Sit Amet",
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const mesh: MessageEvent<MeshMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `mesh`,
      ns: "",
      type: 10,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: -1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#8bc34a", 0.5),
      mesh_resource: "missing",
      mesh_use_embedded_materials: true,
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const triangleList: MessageEvent<TriangleListMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `triangleList`,
      ns: "",
      type: 11,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 1, y: -1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#3f51b5", 0.5),
      points: [
        { x: 0, y: 0.25, z: 0 },
        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },

        { x: 0.25, y: -0.25, z: 0 },
        { x: -0.25, y: -0.25, z: 0 },
        { x: 0, y: -0.5, z: 0 },
      ],
      colors: [makeColor("#f44336", 0.5), makeColor("#4caf50", 0.5), makeColor("#2196f3", 0.5)],
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/markers": [
        arrow,
        cube,
        sphere,
        cylinder,
        lineStrip,
        lineList,
        cubeList,
        sphereList,
        points,
        text,
        mesh,
        triangleList,
      ],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/markers", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/markers", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "base_link",
          cameraState: {
            distance: 5.5,
            perspective: true,
            phi: 0.5,
            targetOffset: [-0.5, 0.75, 0],
            thetaOffset: -0.25,
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

FramelessMarkers.parameters = { colorScheme: "dark", chromatic: { delay: 100 } };
export function FramelessMarkers(): JSX.Element {
  const topics: Topic[] = [{ name: "/markers", schemaName: "visualization_msgs/Marker" }];

  type FramelessHeader = Omit<Header, "frame_id">;
  type FramelessCubeMaker = Omit<CubeMarker, "header"> & { header: FramelessHeader };

  const cube: MessageEvent<FramelessCubeMaker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 } },
      id: `cube`,
      ns: "",
      type: 1,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: -1, y: 1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#e81e63", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/markers": [cube],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/markers", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/markers", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          cameraState: {
            distance: 5.5,
            perspective: true,
            phi: 0.5,
            targetOffset: [-0.5, 0.75, 0],
            thetaOffset: -0.25,
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

ArrowMarkers.parameters = { colorScheme: "dark" };
export function ArrowMarkers(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
    { name: "/arrows", schemaName: "visualization_msgs/Marker" },
  ];

  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const arrow1: MessageEvent<ArrowMarker> = {
    topic: "/arrows",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      id: `arrow1`,
      ns: "",
      type: 0,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0.4, y: 0, z: 1 },
        orientation: QUAT_IDENTITY,
      },
      scale: { x: 0.75, y: 0.001, z: 0.25 },
      color: makeColor("#f44336", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const arrow2: MessageEvent<ArrowMarker> = {
    topic: "/arrows",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `arrow2`,
      ns: "",
      type: 0,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: 0.3, z: 0 },
        orientation: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 },
      },
      scale: { x: 0.3, y: 0.05, z: 0.05 },
      color: makeColor("#4caf50", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const arrow3: MessageEvent<ArrowMarker> = {
    topic: "/arrows",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `arrow3`,
      ns: "",
      type: 0,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: 0, z: 0.35 },
        orientation: { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
      },
      scale: { x: 0.05, y: 0.1, z: 0.15 },
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0.3, y: 0, z: 0 },
      ],
      color: makeColor("#2196f3", 0.5),
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/arrows": [arrow1, arrow2, arrow3],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/arrows", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/arrows", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "base_link",
          cameraState: {
            distance: 4,
            perspective: true,
            phi: 1,
            targetOffset: [-0.6, 0.5, 0],
            thetaOffset: -1,
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

SphereListPointsTransform.parameters = { colorScheme: "dark" };
export function SphereListPointsTransform(): JSX.Element {
  function makeSphere(
    id: string,
    color: string,
    scale: number,
  ): MessageEvent<DeepWritable<SphereListMarker>> {
    return {
      topic: "/sphere",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "camera_color_optical_frame" },
        id,
        ns: "",
        type: 7,
        action: 0,
        frame_locked: false,
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
        points: [
          {
            x: 0,
            y: 0,
            z: 0,
          },
        ],
        scale: { x: scale, y: scale, z: scale },
        color: makeColor(color, 1),
        lifetime: { sec: 0, nsec: 0 },
      },
      schemaName: "visualization_msgs/Marker",
      sizeInBytes: 0,
    };
  }

  const topics: Topic[] = [
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
    { name: "/sphere", schemaName: "visualization_msgs/Marker" },
  ];

  const tf1: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "camera_link" },
      child_frame_id: "camera_color_optical_frame",
      transform: {
        translation: { x: 0.5, y: -0.5, z: 0 },
        rotation: {
          x: -0.5,
          y: 0.5,
          z: -0.5,
          w: 0.5,
        },
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const sphere1 = makeSphere("sphere1", "#ff0000", 0.1);
  sphere1.message.pose.position.x = 0.5;

  const sphere2 = makeSphere("sphere2", "#00ff00", 0.1);
  sphere2.message.pose.position.y = 0.5;

  const sphere3 = makeSphere("sphere3", "#0000ff", 0.1);
  sphere3.message.pose.position.z = 0.5;

  const sphere4 = makeSphere("sphere4", "#ff0000", 0.2);
  sphere4.message.points[0]!.x = 0.75;

  const sphere5 = makeSphere("sphere5", "#00ff00", 0.2);
  sphere5.message.points[0]!.y = 0.75;

  const sphere6 = makeSphere("sphere6", "#0000ff", 0.2);
  sphere6.message.points[0]!.z = 0.75;

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/tf": [tf1],
      "/sphere": [sphere1, sphere2, sphere3, sphere4, sphere5, sphere6],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/sphere", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/sphere", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "camera_link",
          cameraState: {
            distance: 4,
            perspective: true,
            phi: 1.2,
            targetOffset: [0.5, 0, 0],
            thetaOffset: -0.5,
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
export function TransformInterpolation(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
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
    schemaName: "geometry_msgs/TransformStamped",
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
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const pass1 = makePass({
    id: 1,
    frame_id: "base_link",
    stamp: fromSec(1),
    colorHex: testColors.MARKER_GREEN1,
  });
  const pass2 = makePass({
    id: 2,
    frame_id: "base_link",
    stamp: fromSec(1),
    colorHex: testColors.MARKER_GREEN2,
    frame_locked: true,
  });
  const pass3 = makePass({
    id: 3,
    frame_id: "base_link",
    stamp: fromSec(2),
    colorHex: testColors.MARKER_GREEN3,
    pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });

  const fixture = useDelayedFixture({
    datatypes,
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

MarkerLifetimes.parameters = { colorScheme: "dark" };
export function MarkerLifetimes(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
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
    frame_id: "base_link",
    stamp: fromSec(1),
    colorHex: testColors.MARKER_GREEN1,
    pose: { position: { x: -1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });
  const pass2 = makePass({
    id: 2,
    frame_id: "sensor",
    stamp: fromSec(2),
    colorHex: testColors.MARKER_GREEN2,
    pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });
  const pass3 = makePass({
    id: 3,
    frame_id: "sensor",
    stamp: fromSec(1),
    colorHex: testColors.MARKER_GREEN3,
    lifetime: { sec: 1, nsec: 0 },
    pose: { position: { x: 2, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });

  const fail1 = makeFail({
    id: 1,
    frame_id: "base_link",
    stamp: fromSec(0),
    colorHex: testColors.MARKER_RED1,
    description: "No transform from base_link to map at t0",
  });
  const fail2 = makeFail({
    id: 2,
    frame_id: "base_link",
    stamp: fromSec(3),
    colorHex: testColors.MARKER_RED2,
    pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
    description: "t3 is ahead of currentTime (t2)",
  });
  const fail3 = makeFail({
    id: 3,
    frame_id: "missing",
    stamp: fromSec(1),
    colorHex: testColors.MARKER_RED3,
    description: `No transform(s) for coordinate frame "missing"`,
  });
  const fail4 = makeFail({
    id: 4,
    frame_id: "sensor",
    stamp: fromSec(1),
    colorHex: testColors.MARKER_RED1,
    lifetime: { sec: 0, nsec: 1 },
    pose: { position: { x: 0, y: 1, z: 0 }, orientation: QUAT_IDENTITY },
    description: `Expired at t1:1, currentTime is t2`,
  });

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/markers": [pass1, pass2, pass3, fail1, fail2, fail3, fail4],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 2, nsec: 0 },
    },
  });

  const KEYS = ["name:Topics", "t:/tf", "t:/markers", "ns:/tf:base_link", "ns:/tf:map", "ns:/tf:sensor"]; // prettier-ignore

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: KEYS,
          expandedKeys: KEYS,
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

Marker_PointCloud2_Alignment.parameters = { colorScheme: "dark" };
export function Marker_PointCloud2_Alignment(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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

  const points: MessageEvent<PointsMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      id: `points`,
      ns: "",
      type: 8,
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
      type: 102,
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
      is_dense: 1,
    },
    schemaName: "sensor_msgs/PointCloud2",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
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
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/markers",
            "t:/pointcloud",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          expandedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/markers",
            "t:/pointcloud",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          settingsByKey: {
            "t:/pointcloud": {
              pointSize: 30,
              colorMode: { mode: "rgba", rgbByteOrder: "abgr" },
            },
          },
          followTf: "base_link",
          cameraState: {
            distance: 4,
            perspective: true,
            phi: 1,
            targetOffset: [-0.22, 2.07, 0],
            thetaOffset: -0.65,
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

Foxglove_Color.parameters = { colorScheme: "dark" };
export function Foxglove_Color(): JSX.Element {
  const topics: Topic[] = [{ name: "/color", schemaName: "foxglove.Color" }];
  const color: MessageEvent<FoxgloveMessages["foxglove.Color"]> = {
    topic: "/color",
    receiveTime: { sec: 0, nsec: 0 },
    message: { r: 1, g: 0.5, b: 0, a: 0.5 },
    schemaName: "foxglove.Color",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/color": [color],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 1, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/color", `t:${FOXGLOVE_GRID_TOPIC}`],
        }}
      />
    </PanelSetup>
  );
}

Foxglove_Grid.parameters = { colorScheme: "dark" };
export function Foxglove_Grid(): JSX.Element {
  const topics: Topic[] = [{ name: "/grid", schemaName: "foxglove.Grid" }];
  const width = 5;
  const height = 3;
  const offset = 2;
  const row_stride = width + offset;
  const data = new Uint8Array(row_stride * height);
  const view = new DataView(data.buffer);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      view.setInt8(r * row_stride + c + offset, (100 * (r * width + c)) / (width * height));
    }
  }
  view.setInt8(offset + 0, -2);
  view.setInt8(offset + 1, -3);
  const grid: MessageEvent<FoxgloveMessages["foxglove.Grid"]> = {
    topic: "/grid",
    receiveTime: { sec: 0, nsec: 0 },
    sizeInBytes: 0,
    schemaName: "foxglove.Grid",
    message: {
      frame_id: "",
      timestamp: { sec: 1, nsec: 0 },
      pose: {
        position: { x: 0, y: 0, z: 1 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      fields: [{ name: "X", type: 2, offset }],
      data,
      cell_size: { x: 1, y: 1 },
      cell_stride: 1,
      column_count: width,
      row_stride,
    },
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: { "/grid": [grid] },
    capabilities: [],
    activeData: { currentTime: { sec: 1, nsec: 0 } },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/grid", `t:${FOXGLOVE_GRID_TOPIC}`],
          cameraState: { ...DEFAULT_CAMERA_STATE, distance: 15 },
        }}
      />
    </PanelSetup>
  );
}

Foxglove_PointCloud.parameters = { colorScheme: "dark" };
export function Foxglove_PointCloud(): JSX.Element {
  const topics: Topic[] = [{ name: "/pointcloud", schemaName: "foxglove.PointCloud" }];
  const count = 5;
  const point_stride = 8 + 8 + 8 + 4;
  const data = new Uint8Array(point_stride * count);
  const view = new DataView(data.buffer);
  for (let i = 0; i < count; i++) {
    const offset = i * point_stride;
    view.setFloat64(offset, 0, true);
    view.setFloat64(offset + 8, i, true);
    view.setFloat64(offset + 16, 0, true);
    const r = Math.round((i / count) * 0xff);
    const g = 0xff;
    const b = Math.round((1 - i / count) * 0xff);
    const rgb = ((((r << 8) | g) << 8) | b) << 8;
    view.setUint32(offset + 24, rgb);
  }
  const pointcloud: MessageEvent<FoxgloveMessages["foxglove.PointCloud"]> = {
    topic: "/pointcloud",
    receiveTime: { sec: 0, nsec: 0 },
    sizeInBytes: 0,
    schemaName: "foxglove.PointCloud",
    message: {
      frame_id: "",
      timestamp: { sec: 1, nsec: 0 },
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      fields: [
        { name: "x", type: 8, offset: 0 },
        { name: "y", type: 8, offset: 8 },
        { name: "z", type: 8, offset: 16 },
        { name: "rgb", type: 6, offset: 24 },
      ],
      data,
      point_stride,
    },
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: { "/pointcloud": [pointcloud] },
    capabilities: [],
    activeData: { currentTime: { sec: 1, nsec: 0 } },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/pointcloud", `t:${FOXGLOVE_GRID_TOPIC}`],
          cameraState: { ...DEFAULT_CAMERA_STATE, distance: 15 },
          settingsByKey: {
            "t:/pointcloud": { pointSize: 10 },
          },
        }}
      />
    </PanelSetup>
  );
}

Foxglove_LaserScan.parameters = { colorScheme: "dark" };
export function Foxglove_LaserScan(): JSX.Element {
  const topics: Topic[] = [{ name: "/laserscan", schemaName: "foxglove.LaserScan" }];
  const count = 10;
  const ranges = new Array(count).fill(3);
  const intensities = ranges.map((_, i) => i);
  const laserscan: MessageEvent<FoxgloveMessages["foxglove.LaserScan"]> = {
    topic: "/laserscan",
    receiveTime: { sec: 0, nsec: 0 },
    sizeInBytes: 0,
    schemaName: "foxglove.LaserScan",
    message: {
      frame_id: "",
      timestamp: { sec: 1, nsec: 0 },
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      start_angle: 0,
      end_angle: Math.PI / 2,
      ranges,
      intensities,
    },
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: { "/laserscan": [laserscan] },
    capabilities: [],
    activeData: { currentTime: { sec: 1, nsec: 0 } },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/laserscan", `t:${FOXGLOVE_GRID_TOPIC}`],
          cameraState: { ...DEFAULT_CAMERA_STATE, distance: 15 },
          settingsByKey: {
            "t:/laserscan": { pointSize: 10 },
          },
        }}
      />
    </PanelSetup>
  );
}

GeometryMsgs_Polygon.parameters = { colorScheme: "dark" };
export function GeometryMsgs_Polygon(): JSX.Element {
  const topics: Topic[] = [
    { name: "/polygon", schemaName: "geometry_msgs/PolygonStamped" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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

  const polygon: MessageEvent<GeometryMsgs$PolygonStamped> = {
    topic: "/polygon",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      polygon: {
        points: [
          { x: -1, y: -1, z: 0 },
          { x: 0, y: 0, z: 2 },
          { x: 1, y: 1, z: 0 },
        ],
      },
    },
    schemaName: "geometry_msgs/PolygonStamped",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/polygon": [polygon],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/tf", "t:/polygon", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/tf", "t:/polygon", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "base_link",
          cameraState: {
            distance: 8.25,
            perspective: true,
            phi: 1,
            targetOffset: [-0.7, 2.1, 0],
            thetaOffset: -0.25,
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

export const GeometryMsgs_PoseArray = (): JSX.Element => <GeometryMsgs_PoseArray_Base />;
GeometryMsgs_PoseArray.parameters = { colorScheme: "dark" };
export const GeometryMsgs_PoseArray_Line = (): JSX.Element => (
  <GeometryMsgs_PoseArray_Base displayType="line" />
);
GeometryMsgs_PoseArray_Line.parameters = { colorScheme: "dark" };

function GeometryMsgs_PoseArray_Base({ displayType }: { displayType?: string }): JSX.Element {
  const topics: Topic[] = [
    { name: "/baselink_path", schemaName: "geometry_msgs/PoseArray" },
    { name: "/sensor_path", schemaName: "geometry_msgs/PoseArray" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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
  const tf3: MessageEvent<TF> = {
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

  const baseLinkPath: MessageEvent<GeometryMsgs$PoseArray> = {
    topic: "/baselink_path",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      poses: [...Array(10)].map((_, i) => ({
        position: { x: 5, y: i / 4, z: 1 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "geometry_msgs/PoseArray",
    sizeInBytes: 0,
  };

  const sensorPath: MessageEvent<GeometryMsgs$PoseArray> = {
    topic: "/sensor_path",
    receiveTime: { sec: 3, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      poses: [...Array(10)].map((_, i) => ({
        position: { x: 5, y: i / 4, z: 2 },
        orientation: makeOrientation(i),
      })),
    },
    schemaName: "geometry_msgs/PoseArray",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
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
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/baselink_path",
            "t:/sensor_path",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          expandedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/baselink_path",
            "t:/sensor_path",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          followTf: "base_link",
          settingsByKey: {
            "t:/sensor_path": {
              overrideColor: { r: 1, g: 0, b: 0, a: 0.2 },
              size: { shaftWidth: 1, headWidth: 2, headLength: 0.5, length: 2 },
              lineThickness: 0.5,
              displayType,
            },
            "t:/baselink_path": {
              lineThickness: 0.1,
              displayType,
            },
          },
          cameraState: {
            distance: 25,
            perspective: true,
            phi: 0.25,
            targetOffset: [0, 2, 0],
            thetaOffset: -0.25,
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
GeometryMsgs_PoseStamped.parameters = { colorScheme: "dark" };
export function GeometryMsgs_PoseStamped(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
    { name: "/pose1", schemaName: "geometry_msgs/PoseStamped" },
    { name: "/pose2", schemaName: "geometry_msgs/PoseStamped" },
  ];

  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/pose1": [pose1],
      "/pose2": [pose2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/pose1", "t:/pose2", "t:/tf", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "base_link",
          settingsByKey: {
            "t:/pose1": {},
            "t:/pose2": {
              size: {
                shaftLength: 2,
                shaftWidth: 1,
                headLength: 1,
                headWidth: 2,
              },
              overrideColor: { r: 1, g: 0, b: 0, a: 0.3 },
            },
          },
          cameraState: {
            distance: 15,
            perspective: false,
            phi: 0,
            targetOffset: [-0.6, 0.5, 0],
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

NavMsgs_Path.parameters = { colorScheme: "dark" };
export function NavMsgs_Path(): JSX.Element {
  const topics: Topic[] = [
    { name: "/baselink_path", schemaName: "nav_msgs/Path" },
    { name: "/sensor_path", schemaName: "nav_msgs/Path" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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
  const tf3: MessageEvent<TF> = {
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

  const baseLinkPath: MessageEvent<NavMsgs$Path> = {
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

  const sensorPath: MessageEvent<NavMsgs$Path> = {
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
    datatypes,
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
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/baselink_path",
            "t:/sensor_path",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          expandedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/baselink_path",
            "t:/sensor_path",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          followTf: "base_link",
          cameraState: {
            distance: 15,
            perspective: true,
            phi: 1,
            targetOffset: [0, 2, 0],
            thetaOffset: -0.25,
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

SensorMsgs_LaserScan.parameters = { colorScheme: "dark" };
export function SensorMsgs_LaserScan(): JSX.Element {
  const topics: Topic[] = [
    { name: "/laserscan", schemaName: "sensor_msgs/LaserScan" },
    { name: "/laserscan/nointensity", schemaName: "sensor_msgs/LaserScan" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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

  const laserScan: MessageEvent<LaserScan> = {
    topic: "/laserscan",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      angle_min: 0,
      angle_max: 2 * Math.PI,
      angle_increment: (1 / 360) * 2 * Math.PI,
      time_increment: 1 / 360,
      scan_time: 1,
      range_min: 0.001,
      range_max: 10,
      ranges: [...Array(360)].map((_, i) => 4 + (1 + Math.sin(i / 2)) / 2),
      intensities: [...Array(360)].map((_, i) => (1 + Math.sin(i / 2)) / 2),
    },
    schemaName: "sensor_msgs/LaserScan",
    sizeInBytes: 0,
  };

  const laserScanNoIntensity: MessageEvent<LaserScan> = {
    topic: "/laserscan/nointensity",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      angle_min: 0,
      angle_max: 2 * Math.PI,
      angle_increment: (1 / 360) * 2 * Math.PI,
      time_increment: 1 / 360,
      scan_time: 1,
      range_min: 0.001,
      range_max: 10,
      ranges: [...Array(360)].map((_, i) => 1 + (1 + Math.sin(i / 2)) / 2),
      intensities: [],
    },
    schemaName: "sensor_msgs/LaserScan",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/laserscan": [laserScan],
      "/laserscan/nointensity": [laserScanNoIntensity],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/laserscan",
            "t:/laserscan/nointensity",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          expandedKeys: [
            "name:Topics",
            "t:/tf",
            "t:/laserscan",
            "t:/laserscan/nointensity",
            `t:${FOXGLOVE_GRID_TOPIC}`,
          ],
          followTf: "base_link",
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: 1.22,
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: -0.33,
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

export const SensorMsgs_PointCloud2_RGBA = (): JSX.Element => (
  <SensorMsgs_PointCloud2 rgbaFieldName="rgba" />
);
SensorMsgs_PointCloud2_RGBA.parameters = { colorScheme: "dark" };

export const SensorMsgs_PointCloud2_RGB = (): JSX.Element => (
  <SensorMsgs_PointCloud2 rgbaFieldName="rgb" />
);
SensorMsgs_PointCloud2_RGB.parameters = { colorScheme: "dark" };

function SensorMsgs_PointCloud2({ rgbaFieldName }: { rgbaFieldName: string }): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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

  const SCALE = 10 / 128;

  function f(x: number, y: number) {
    return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
  }

  function jet(x: number, a: number): number {
    const i = Math.trunc(x * 255);
    const r = Math.max(0, Math.min(255, 4 * (i - 96), 255 - 4 * (i - 224)));
    const g = Math.max(0, Math.min(255, 4 * (i - 32), 255 - 4 * (i - 160)));
    const b = Math.max(0, Math.min(255, 4 * i + 127, 255 - 4 * (i - 96)));
    return rgba(r / 255, g / 255, b / 255, a);
  }

  const data = new Uint8Array(128 * 128 * 16);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < 128; y += 3) {
    for (let x = 0; x < 128; x += 3) {
      const i = (y * 128 + x) * 16;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5, true);
      view.setUint32(i + 12, jet(f(x, y) * 2, x / 128), true);
    }
  }

  const pointCloud: MessageEvent<PointCloud2> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      type: 102,
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      height: 1,
      width: 128 * 128,
      fields: [
        { name: "x", offset: 0, datatype: 7, count: 1 },
        { name: "y", offset: 4, datatype: 7, count: 1 },
        { name: "z", offset: 8, datatype: 7, count: 1 },
        { name: rgbaFieldName, offset: 12, datatype: 6, count: 1 },
      ],
      is_bigendian: false,
      point_step: 16,
      row_step: 128 * 128 * 16,
      data,
      is_dense: 1,
    },
    schemaName: "sensor_msgs/PointCloud2",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
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
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/tf", "t:/pointcloud", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/tf", "t:/pointcloud", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "base_link",
          settingsByKey: {
            "t:/pointcloud": {
              pointSize: 10,
              colorMode: { mode: rgbaFieldName, rgbByteOrder: "abgr" },
            },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: 1.22,
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: -0.33,
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

SensorMsgs_PointCloud2_Intensity.parameters = { colorScheme: "dark" };
export function SensorMsgs_PointCloud2_Intensity(): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
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
  const tf2: MessageEvent<TF> = {
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

  const WIDTH = 128;
  const HW = 5;
  const SCALE = 10 / WIDTH;
  const SCALE_2 = 0.5 * SCALE;
  const STEP = 13;
  const METABALLS: [number, number, number, number][] = [
    [0, 0, 2, 1.5],
    [2.2, 2, 3, 0.75],
    [2.1, -0.1, 4, 0.5],
    [-1.2, -1, 1, 0.5],
  ];

  const tempVec: vec3 = [0, 0, 0];
  function inside(p: vec3): number {
    let sum = 0;
    for (const metaball of METABALLS) {
      tempVec[0] = metaball[0];
      tempVec[1] = metaball[1];
      tempVec[2] = metaball[2];
      const r = metaball[3];
      const d2 = Math.max(Number.EPSILON, vec3.squaredDistance(p, tempVec) - r * r);
      sum += Math.pow(1 / d2, 2);
    }
    return sum >= 1 ? 1 : 0;
  }

  function countInside(xi: number, yi: number, zi: number): number {
    const p0: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE - SCALE_2];
    const p1: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE - SCALE_2];
    const p2: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE - SCALE_2];
    const p3: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE - SCALE_2];
    const p4: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE + SCALE_2];
    const p5: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE + SCALE_2];
    const p6: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE + SCALE_2];
    const p7: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE + SCALE_2];

    return (
      inside(p0) +
      inside(p1) +
      inside(p2) +
      inside(p3) +
      inside(p4) +
      inside(p5) +
      inside(p6) +
      inside(p7)
    );
  }

  const data = new Uint8Array(WIDTH * WIDTH * WIDTH * STEP);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let zi = 0; zi < WIDTH; zi++) {
    for (let yi = 0; yi < WIDTH; yi++) {
      for (let xi = 0; xi < WIDTH; xi++) {
        const i = (zi * WIDTH + yi) * WIDTH * STEP + xi * STEP;
        const count = countInside(xi, yi, zi);
        if (count !== 0 && count !== 8) {
          view.setFloat32(i + 0, xi * SCALE - HW, true);
          view.setFloat32(i + 4, yi * SCALE - HW, true);
          view.setFloat32(i + 8, zi * SCALE, true);
          const position = xi * 0.5 + yi * 0.5 + zi * 0.5;
          const surface = ((count / 7) * 255) / 2 + (xi / 2 + yi / 2 + zi / 2);
          view.setUint8(i + 12, Math.trunc(position * 0.8 + surface * 0.2));
        } else {
          view.setFloat32(i + 0, Number.NaN, true);
          view.setFloat32(i + 4, Number.NaN, true);
          view.setFloat32(i + 8, Number.NaN, true);
          view.setUint8(i + 12, 255);
        }
      }
    }
  }

  const pointCloud: MessageEvent<PointCloud2> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      type: 102,
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      height: 1,
      width: WIDTH * WIDTH * WIDTH,
      fields: [
        { name: "x", offset: 0, datatype: 7, count: 1 },
        { name: "y", offset: 4, datatype: 7, count: 1 },
        { name: "z", offset: 8, datatype: 7, count: 1 },
        { name: "intensity", offset: 12, datatype: 2, count: 1 },
      ],
      is_bigendian: false,
      point_step: 13,
      row_step: WIDTH * WIDTH * WIDTH * STEP,
      data,
      is_dense: 0,
    },
    schemaName: "sensor_msgs/PointCloud2",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
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
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/tf", "t:/pointcloud", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/tf", "t:/pointcloud", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "base_link",
          settingsByKey: {
            "t:/pointcloud": {
              pointSize: 5,
            },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: 1.22,
            targetOffset: [0.25, -0.5, 3],
            thetaOffset: -0.33,
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

// Should display a topic error to the user when the PointCloud message is missing the necessary
// field descriptions.
SensorMsgs_PointCloud2_InsufficientFields.parameters = { colorScheme: "dark" };
export function SensorMsgs_PointCloud2_InsufficientFields(): JSX.Element {
  const topics: Topic[] = [{ name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" }];

  const SCALE = 10 / 128;

  function f(x: number, y: number) {
    return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
  }

  const data = new Uint8Array(128 * 128 * 12);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 12;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5, true);
    }
  }

  const pointCloud: MessageEvent<PointCloud2> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      type: 102,
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      height: 1,
      width: 128 * 128,
      fields: [
        { name: "x", offset: 0, datatype: 7, count: 1 },
        { name: "y", offset: 4, datatype: 7, count: 1 },
      ],
      is_bigendian: false,
      point_step: 12,
      row_step: 128 * 128 * 12,
      data,
      is_dense: 1,
    },
    schemaName: "sensor_msgs/PointCloud2",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/pointcloud": [pointCloud],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/pointcloud", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/pointcloud", `t:${FOXGLOVE_GRID_TOPIC}`],
          pinTopics: true,
          followTf: "sensor",
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: 1.22,
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: -0.33,
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

LargeTransform.parameters = { colorScheme: "dark" };
export function LargeTransform(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "odom",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "odom" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const pass1 = makePass({
    id: 1,
    frame_id: "map",
    stamp: fromSec(0),
    colorHex: testColors.MARKER_GREEN1,
    pose: { position: { x: 1e7, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });
  const pass2 = makePass({
    id: 2,
    frame_id: "base_link",
    stamp: fromSec(0),
    colorHex: testColors.MARKER_GREEN2,
  });
  const pass3 = makePass({
    id: 3,
    frame_id: "odom",
    stamp: fromSec(0),
    colorHex: testColors.MARKER_GREEN3,
    pose: { position: { x: 2, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/markers": [pass1, pass2, pass3],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  const KEYS = ["name:Topics", "t:/tf", "t:/markers", "ns:/tf:base_link", "ns:/tf:map", "ns:/tf:odom"]; // prettier-ignore

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: KEYS,
          expandedKeys: KEYS,
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

STLMeshMarkers.parameters = { colorScheme: "dark" };
export function STLMeshMarkers(): JSX.Element {
  const topics: Topic[] = [{ name: "/markers", schemaName: "visualization_msgs/Marker" }];

  const mesh: MessageEvent<MeshMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
      id: `mesh`,
      ns: "",
      type: 10,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: -1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#8bc34a", 0.5),
      mesh_resource: encodeURI(`data:model/stl;utf8,solid AssimpScene
  facet normal 0 0 -1 outer loop vertex -0.5 -0.5 -0.5 vertex -0.5 0.5 -0.5 vertex 0.5 0.5 -0.5 endloop endfacet
  facet normal 0 0 -1 outer loop vertex 0.5 0.5 -0.5 vertex 0.5 -0.5 -0.5 vertex -0.5 -0.5 -0.5 endloop endfacet
  facet normal 0 0 1 outer loop vertex 0.5 -0.5 0.5 vertex 0.5 0.5 0.5 vertex -0.5 0.5 0.5 endloop endfacet
  facet normal 0 0 1 outer loop vertex -0.5 0.5 0.5 vertex -0.5 -0.5 0.5 vertex 0.5 -0.5 0.5 endloop endfacet
  facet normal 0 1 0 outer loop vertex -0.5 0.5 0.5 vertex 0.5 0.5 0.5 vertex 0.5 0.5 -0.5 endloop endfacet
  facet normal 0 1 0 outer loop vertex 0.5 0.5 -0.5 vertex -0.5 0.5 -0.5 vertex -0.5 0.5 0.5 endloop endfacet
  facet normal 1 0 0 outer loop vertex 0.5 0.5 0.5 vertex 0.5 -0.5 0.5 vertex 0.5 -0.5 -0.5 endloop endfacet
  facet normal 1 0 0 outer loop vertex 0.5 -0.5 -0.5 vertex 0.5 0.5 -0.5 vertex 0.5 0.5 0.5 endloop endfacet
  facet normal 0 -1 0 outer loop vertex 0.5 -0.5 0.5 vertex -0.5 -0.5 0.5 vertex -0.5 -0.5 -0.5 endloop endfacet
  facet normal 0 -1 0 outer loop vertex -0.5 -0.5 -0.5 vertex 0.5 -0.5 -0.5 vertex 0.5 -0.5 0.5 endloop endfacet
  facet normal -1 0 0 outer loop vertex -0.5 -0.5 0.5 vertex -0.5 0.5 0.5 vertex -0.5 0.5 -0.5 endloop endfacet
  facet normal -1 0 0 outer loop vertex -0.5 0.5 -0.5 vertex -0.5 -0.5 -0.5 vertex -0.5 -0.5 0.5 endloop endfacet
endsolid AssimpScene`),
      mesh_use_embedded_materials: true,
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const coloredMesh = {
    ...mesh,
    message: {
      ...mesh.message,
      id: "coloredMesh",
      mesh_use_embedded_materials: false,
      pose: { ...mesh.message.pose, position: { x: -1, y: 0, z: 0 } },
    },
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: { "/markers": [mesh, coloredMesh] },
    capabilities: [],
    activeData: { currentTime: { sec: 0, nsec: 0 } },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDimensionalViz
        overrideConfig={{
          ...ThreeDimensionalViz.defaultConfig,
          checkedKeys: ["name:Topics", "t:/markers", `t:${FOXGLOVE_GRID_TOPIC}`],
          cameraState: { ...DEFAULT_CAMERA_STATE, distance: 5, thetaOffset: 1 },
        }}
      />
    </PanelSetup>
  );
}
