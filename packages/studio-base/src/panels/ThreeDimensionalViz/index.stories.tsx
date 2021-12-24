// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosMsgDefinition } from "@foxglove/rosmsg";
import { fromSec, Time } from "@foxglove/rostime";
import { MessageEvent, Topic } from "@foxglove/studio";
import useDelayedFixture from "@foxglove/studio-base/panels/ThreeDimensionalViz/stories/useDelayedFixture";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import {
  ArrowMarker,
  CubeListMarker,
  CubeMarker,
  CylinderMarker,
  LaserScan,
  LineListMarker,
  LineStripMarker,
  MeshMarker,
  Point,
  PointCloud2,
  PointsMarker,
  Pose,
  SphereListMarker,
  SphereMarker,
  TextMarker,
  TF,
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
  const color = hexToColorObj(hex, alpha);
  if (alpha != undefined) {
    // Mutate the otherwise readonly Color object
    (color as { a: number }).a = alpha;
  }
  return color;
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
    sizeInBytes: 0,
  };
}

const datatypes = new Map<string, RosMsgDefinition>(
  Object.entries({
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

export function Markers(): JSX.Element {
  const topics: Topic[] = [{ name: "/markers", datatype: "visualization_msgs/Marker" }];

  const arrow: MessageEvent<ArrowMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const cube: MessageEvent<CubeMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const sphere: MessageEvent<SphereMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const cylinder: MessageEvent<CylinderMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const lineStrip: MessageEvent<LineStripMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const lineList: MessageEvent<LineListMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const cubeList: MessageEvent<CubeListMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const sphereList: MessageEvent<SphereListMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const points: MessageEvent<PointsMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

  const text: MessageEvent<TextMarker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
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
    sizeInBytes: 0,
  };

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
      mesh_resource: "missing",
      mesh_use_embedded_materials: true,
      lifetime: { sec: 0, nsec: 0 },
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
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
          checkedKeys: ["name:Topics", "t:/markers", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/markers", `t:${FOXGLOVE_GRID_TOPIC}`],
          followTf: "",
          cameraState: {
            distance: 5.5,
            perspective: true,
            phi: 0.5,
            targetOffset: [0, 0, 0],
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

export function TransformInterpolation(): JSX.Element {
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

export function MarkerLifetimes(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", datatype: "visualization_msgs/Marker" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
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

export function SensorMsgs_LaserScan(): JSX.Element {
  const topics: Topic[] = [
    { name: "/laserscan", datatype: "sensor_msgs/LaserScan" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
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
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    datatypes,
    topics,
    frame: {
      "/laserscan": [laserScan],
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
          checkedKeys: ["name:Topics", "t:/tf", "t:/laserscan", `t:${FOXGLOVE_GRID_TOPIC}`],
          expandedKeys: ["name:Topics", "t:/tf", "t:/laserscan", `t:${FOXGLOVE_GRID_TOPIC}`],
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

export function SensorMsgs_PointCloud2_RGBA(): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", datatype: "sensor_msgs/PointCloud2" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
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
    sizeInBytes: 0,
  };

  const SCALE = 10 / 128;

  function f(x: number, y: number) {
    return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
  }

  function rgba(r: number, g: number, b: number, a: number) {
    return (
      (Math.trunc(r * 255) << 24) |
      (Math.trunc(g * 255) << 16) |
      (Math.trunc(b * 255) << 8) |
      Math.trunc(a * 255)
    );
  }

  function jet(x: number): number {
    const i = Math.trunc(x * 255);
    const r = Math.max(0, Math.min(255, 4 * (i - 96), 255 - 4 * (i - 224)));
    const g = Math.max(0, Math.min(255, 4 * (i - 32), 255 - 4 * (i - 160)));
    const b = Math.max(0, Math.min(255, 4 * i + 127, 255 - 4 * (i - 96)));
    return rgba(r / 255, g / 255, b / 255, 0.5 + x / 2);
  }

  const data = new Uint8Array(128 * 128 * 16);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 16;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5, true);
      view.setUint32(i + 12, jet(f(x, y) * 2), false);
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
        { name: "rgba", offset: 12, datatype: 6, count: 1 },
      ],
      is_bigendian: false,
      point_step: 16,
      row_step: 128 * 128 * 16,
      data,
      is_dense: 0,
    },
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

export function LargeTransform(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", datatype: "visualization_msgs/Marker" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
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

LargeTransform.parameters = { colorScheme: "dark" };
MarkerLifetimes.parameters = { colorScheme: "dark" };
Markers.parameters = { colorScheme: "dark" };
SensorMsgs_LaserScan.parameters = { colorScheme: "dark" };
SensorMsgs_PointCloud2_RGBA.parameters = { colorScheme: "dark" };
TransformInterpolation.parameters = { colorScheme: "dark" };
