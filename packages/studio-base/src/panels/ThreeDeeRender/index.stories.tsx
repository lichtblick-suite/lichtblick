// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";

import { MessageEvent, Topic } from "@foxglove/studio";
import useDelayedFixture from "@foxglove/studio-base/panels/ThreeDimensionalViz/stories/useDelayedFixture";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { stringToRgba } from "./color";
import ThreeDeeRender from "./index";
import {
  CameraInfo,
  ColorRGBA,
  CompressedImage,
  Image,
  Marker,
  MarkerType,
  PoseStamped,
  PoseWithCovarianceStamped,
  TF,
  Vector3,
} from "./ros";

const QUAT_IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

const PNG_TEST_IMAGE_BASE64 =
  "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gGgAQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBQDQAIBoARAOAaABANACIBgBEA4BoABANAIgGANEAIBoAEA0AogGgEg0AiAYA0QAgGgAQDQCiAQDRACAaAEQDAKIBQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBANEAIBoARAMAogFANACIBgBEA4BoABANAIgGANEAgGgAEA0AogEA0QAgGgBEAwCiAUA0AIgGAEQDgGgAQDQAiAYA0QCAaAAQDQCiAQDRACAaAEQDAKIBQDQAiAYARAOAaABANACIBgDRAIBoABANAKIBANEAIBoARAMAogFANAAgGgBEA4BoAEA0AIgGANEAgGgAEA0AogEA0QAgGgBEAwCiAUA0ACAaAEQDgGgAQDQAiAYA0QCAaAAQDQCiAQDRACAaABANAKIBQDQAIBoARAOAaABANACIBgDRAIBoABANAKIBANEAIBoAEA0AogFANAAgGgBEA4BoAEA0AIgGANEAgGgAEA0AiAYA0QAgGgAQDQCiAUA0ACAaAEQDgGgAQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBQDQAIBoARAOAaABANACIBgBEA4BoABANAIgGANEAIBoAEA0AogFANAAgGgBEAwCiAUA0AIgGAEQDgGgAEA0AiAYA0QAgGgAQDQCiAUA0ACAaAEQDAKIBQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBANEAIBoARAMAogFANACIBgBEA4BoABANAIgGANEAIBoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABg5BMsx4VVAPgdJ4ZVIM4gDT62AAAAAElFTkSuQmCC";
const PNG_TEST_IMAGE = new Uint8Array(base64.length(PNG_TEST_IMAGE_BASE64));
base64.decode(PNG_TEST_IMAGE_BASE64, PNG_TEST_IMAGE, 0);

function makeColor(hex: string, alpha?: number): ColorRGBA {
  const color = stringToRgba({ r: 0, g: 0, b: 0, a: 1 }, hex);
  if (alpha != undefined) {
    color.a = alpha;
  }
  return color;
}

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

const SENSOR_FRAME_ID = "sensor";
const BASE_LINK_FRAME_ID = "base_link";
const FIXED_FRAME_ID = "map";

Markers.parameters = { colorScheme: "dark", chromatic: { delay: 100 } };
export function Markers(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/markers", datatype: "visualization_msgs/Marker" },
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
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 1, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };

  const arrow: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 0,
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

  const cube: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 1,
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

  const sphere: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 2,
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

  const cylinder: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 3,
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

  const lineStrip: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 4,
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

  const lineList: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 5,
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

  const cubeList: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 6,
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

  const sphereList: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 7,
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

  const points: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 8,
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

  const text: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 9,
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

  const mesh: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 10,
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

  const triangleList: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 11,
      ns: "",
      type: 11,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 1, y: -1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#e81e63", 0.5),
      points: [
        // front
        { x: -0.25, y: -0.25, z: 0.25 },
        { x: 0.25, y: -0.25, z: 0.25 },
        { x: -0.25, y: 0.25, z: 0.25 },
        { x: -0.25, y: 0.25, z: 0.25 },
        { x: 0.25, y: -0.25, z: 0.25 },
        { x: 0.25, y: 0.25, z: 0.25 },
        // right
        { x: 0.25, y: -0.25, z: 0.25 },
        { x: 0.25, y: -0.25, z: -0.25 },
        { x: 0.25, y: 0.25, z: 0.25 },
        { x: 0.25, y: 0.25, z: 0.25 },
        { x: 0.25, y: -0.25, z: -0.25 },
        { x: 0.25, y: 0.25, z: -0.25 },
        // back
        { x: 0.25, y: -0.25, z: -0.25 },
        { x: -0.25, y: -0.25, z: -0.25 },
        { x: 0.25, y: 0.25, z: -0.25 },
        { x: 0.25, y: 0.25, z: -0.25 },
        { x: -0.25, y: -0.25, z: -0.25 },
        { x: -0.25, y: 0.25, z: -0.25 },
        // left
        { x: -0.25, y: -0.25, z: -0.25 },
        { x: -0.25, y: -0.25, z: 0.25 },
        { x: -0.25, y: 0.25, z: -0.25 },
        { x: -0.25, y: 0.25, z: -0.25 },
        { x: -0.25, y: -0.25, z: 0.25 },
        { x: -0.25, y: 0.25, z: 0.25 },
        // top
        { x: 0.25, y: 0.25, z: -0.25 },
        { x: -0.25, y: 0.25, z: -0.25 },
        { x: 0.25, y: 0.25, z: 0.25 },
        { x: 0.25, y: 0.25, z: 0.25 },
        { x: -0.25, y: 0.25, z: -0.25 },
        { x: -0.25, y: 0.25, z: 0.25 },
        // bottom
        { x: 0.25, y: -0.25, z: 0.25 },
        { x: -0.25, y: -0.25, z: 0.25 },
        { x: 0.25, y: -0.25, z: -0.25 },
        { x: 0.25, y: -0.25, z: -0.25 },
        { x: -0.25, y: -0.25, z: 0.25 },
        { x: -0.25, y: -0.25, z: -0.25 },
      ],
      colors: [],
      lifetime: { sec: 0, nsec: 0 },
    },
    sizeInBytes: 0,
  };

  const triangleList2SideColors = [
    makeColor("#f44336"),
    makeColor("#4caf50"),
    makeColor("#2196f3"),
    makeColor("#2196f3"),
    makeColor("#4caf50"),
    makeColor("#ffc107"),
  ];
  const triangleList2Colors: ColorRGBA[] = [];
  for (let i = 0; i < 6; i++) {
    for (const color of triangleList2SideColors) {
      triangleList2Colors.push(color);
    }
  }
  const triangleList2: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 12,
      ns: "",
      type: 11,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 1, y: -1, z: 0.375 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#e81e63", 0.5),
      points: [
        // front
        { x: -0.125, y: -0.125, z: 0.125 },
        { x: 0.125, y: -0.125, z: 0.125 },
        { x: -0.125, y: 0.125, z: 0.125 },
        { x: -0.125, y: 0.125, z: 0.125 },
        { x: 0.125, y: -0.125, z: 0.125 },
        { x: 0.125, y: 0.125, z: 0.125 },
        // right
        { x: 0.125, y: -0.125, z: 0.125 },
        { x: 0.125, y: -0.125, z: -0.125 },
        { x: 0.125, y: 0.125, z: 0.125 },
        { x: 0.125, y: 0.125, z: 0.125 },
        { x: 0.125, y: -0.125, z: -0.125 },
        { x: 0.125, y: 0.125, z: -0.125 },
        // back
        { x: 0.125, y: -0.125, z: -0.125 },
        { x: -0.125, y: -0.125, z: -0.125 },
        { x: 0.125, y: 0.125, z: -0.125 },
        { x: 0.125, y: 0.125, z: -0.125 },
        { x: -0.125, y: -0.125, z: -0.125 },
        { x: -0.125, y: 0.125, z: -0.125 },
        // left
        { x: -0.125, y: -0.125, z: -0.125 },
        { x: -0.125, y: -0.125, z: 0.125 },
        { x: -0.125, y: 0.125, z: -0.125 },
        { x: -0.125, y: 0.125, z: -0.125 },
        { x: -0.125, y: -0.125, z: 0.125 },
        { x: -0.125, y: 0.125, z: 0.125 },
        // top
        { x: 0.125, y: 0.125, z: -0.125 },
        { x: -0.125, y: 0.125, z: -0.125 },
        { x: 0.125, y: 0.125, z: 0.125 },
        { x: 0.125, y: 0.125, z: 0.125 },
        { x: -0.125, y: 0.125, z: -0.125 },
        { x: -0.125, y: 0.125, z: 0.125 },
        // bottom
        { x: 0.125, y: -0.125, z: 0.125 },
        { x: -0.125, y: -0.125, z: 0.125 },
        { x: 0.125, y: -0.125, z: -0.125 },
        { x: 0.125, y: -0.125, z: -0.125 },
        { x: -0.125, y: -0.125, z: 0.125 },
        { x: -0.125, y: -0.125, z: -0.125 },
      ],
      colors: triangleList2Colors,
      lifetime: { sec: 0, nsec: 0 },
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
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
        triangleList2,
      ],
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
          followTf: "base_link",
          scene: { enableStats: false },
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
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/arrows", datatype: "visualization_msgs/Marker" },
  ];

  const tf1: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: FIXED_FRAME_ID },
      child_frame_id: BASE_LINK_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
      },
    },
    sizeInBytes: 0,
  };

  const arrow1: MessageEvent<Partial<Marker>> = {
    topic: "/arrows",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      id: 0,
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
    sizeInBytes: 0,
  };

  const arrow2: MessageEvent<Partial<Marker>> = {
    topic: "/arrows",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 1,
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
    sizeInBytes: 0,
  };

  const arrow3: MessageEvent<Partial<Marker>> = {
    topic: "/arrows",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      id: 2,
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
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
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
      <ThreeDeeRender
        overrideConfig={{
          ...ThreeDeeRender.defaultConfig,
          followTf: "base_link",
          scene: { enableStats: false },
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

AutoSelectFrame.parameters = { colorScheme: "dark" };
export function AutoSelectFrame(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/markers", datatype: "visualization_msgs/Marker" },
  ];

  const tf1: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: FIXED_FRAME_ID },
      child_frame_id: BASE_LINK_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
      },
    },
    sizeInBytes: 0,
  };

  const arrow: MessageEvent<Partial<Marker>> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      id: 1,
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
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/arrows": [arrow],
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
          followTf: undefined,
          scene: { enableStats: false },
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

PoseMarkers.parameters = { colorScheme: "dark" };
export function PoseMarkers(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/pose", datatype: "geometry_msgs/PoseStamped" },
    { name: "/pose_with_covariance", datatype: "geometry_msgs/PoseWithCovarianceStamped" },
    { name: "/pose_with_hidden_covariance", datatype: "geometry_msgs/PoseWithCovarianceStamped" },
  ];

  const tf1: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: FIXED_FRAME_ID },
      child_frame_id: BASE_LINK_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
      },
    },
    sizeInBytes: 0,
  };

  const pose1: MessageEvent<Partial<PoseStamped>> = {
    topic: "/pose",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      pose: {
        position: { x: 0, y: 0, z: -1 },
        orientation: { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
      },
    },
    sizeInBytes: 0,
  };

  const pose2: MessageEvent<Partial<PoseWithCovarianceStamped>> = {
    topic: "/pose_with_covariance",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      pose: {
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: QUAT_IDENTITY,
        },
        // prettier-ignore
        covariance: [
          2 * 2, 0, 0, 0, 0, 0,
          0, 0.15 * 0.15, 0, 0, 0, 0,
          0, 0, 0.3 * 0.3, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
        ],
      },
    },
    sizeInBytes: 0,
  };

  const pose3: MessageEvent<Partial<PoseWithCovarianceStamped>> = {
    topic: "/pose_with_hidden_covariance",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      pose: {
        pose: {
          position: { x: -1, y: 0, z: -1 },
          orientation: { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
        },
        // prettier-ignore
        covariance: [
          1, 0, 0, 0, 0, 0,
          0, 1, 0, 0, 0, 0,
          0, 0, 1, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
        ],
      },
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/pose": [pose1],
      "/pose_with_covariance": [pose2],
      "/pose_with_hidden_covariance": [pose3],
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
          followTf: "base_link",
          scene: { enableStats: false },
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
          topics: {
            "/pose": {
              color: "rgba(107, 220, 255, 0.5)",
            },
            "/pose_with_hidden_covariance": {
              showCovariance: false,
              covarianceColor: "rgba(255, 0, 0, 1)",
            },
          },
        }}
      />
    </PanelSetup>
  );
}

export function LabelMarkers(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/labels", datatype: "visualization_msgs/Marker" },
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
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 1, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };

  let id = 0;
  const makeLabel = (
    text: string,
    position: Vector3,
    colorHex: string,
    alpha = 1,
  ): MessageEvent<Partial<Marker>> => {
    return {
      topic: "/labels",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
        id: id++,
        ns: "",
        action: 0,
        type: MarkerType.TEXT_VIEW_FACING,
        text,
        frame_locked: true,
        color: makeColor(colorHex, alpha),
        pose: { position, orientation: QUAT_IDENTITY },
      },
      sizeInBytes: 0,
    };
  };

  const label1 = makeLabel("Hello, world!", { x: -2, y: 1, z: 0 }, "#e60049");
  const label2 = makeLabel("Hello, world!", { x: -1, y: 1, z: 0 }, "#0bb4ff");
  const label3 = makeLabel("Hello, world!", { x: 0, y: 1, z: 0 }, "#50e991");
  const label4 = makeLabel("Hello, world!", { x: 1, y: 1, z: 0 }, "#e6d800");
  const label5 = makeLabel("Hello, world!", { x: -2, y: 0, z: 0 }, "#9b19f5");
  const label6 = makeLabel("Hello, world!", { x: -1, y: 0, z: 0 }, "#ffa300");
  const label7 = makeLabel("Hello, world!", { x: 1, y: 0, z: 0 }, "#dc0ab4");
  const label8 = makeLabel("Hello, world!", { x: -2, y: -1, z: 0 }, "#b3d4ff");
  const label9 = makeLabel("Hello, world!", { x: -1, y: -1, z: 0 }, "#00bfa0");
  const label10 = makeLabel("Hello, world!", { x: 0, y: -1, z: 0 }, "#b30000");
  const label11 = makeLabel("Hello, world!", { x: 1, y: -1, z: 0 }, "#7c1158");

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      // prettier-ignore
      "/labels": [label1, label2, label3, label4, label5, label6, label7, label8, label9, label10, label11],
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
          followTf: "base_link",
          scene: { enableStats: false },
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

CameraInfoRender.parameters = { colorScheme: "dark" };
export function CameraInfoRender(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/rational_polynomial", datatype: "sensor_msgs/CameraInfo" },
    { name: "/none", datatype: "sensor_msgs/CameraInfo" },
    { name: "/empty", datatype: "sensor_msgs/CameraInfo" },
  ];

  const tf1: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: FIXED_FRAME_ID },
      child_frame_id: BASE_LINK_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
      },
    },
    sizeInBytes: 0,
  };

  const cam1: MessageEvent<Partial<CameraInfo>> = {
    topic: "/rational_polynomial",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 480,
      width: 640,
      distortion_model: "rational_polynomial",
      D: [0.452407, 0.273748, -0.00011, 0.000152, 0.027904, 0.817958, 0.358389, 0.108657],
      K: [
        381.22076416015625, 0, 318.88323974609375, 0, 381.22076416015625, 233.90321350097656, 0, 0,
        1,
      ],
      R: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      P: [
        381.22076416015625, 0, 318.88323974609375, 0.015031411312520504, 0, 381.22076416015625,
        233.90321350097656, -0.00011014656047336757, 0, 0, 1, 0.000024338871298823506,
      ],
    },
    sizeInBytes: 0,
  };

  const cam2: MessageEvent<Partial<CameraInfo>> = {
    topic: "/none",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 900,
      width: 1600,
      distortion_model: "",
      D: [],
      K: [
        1266.417203046554, 0, 816.2670197447984, 0, 1266.417203046554, 491.50706579294757, 0, 0, 1,
      ],
      R: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      P: [
        1266.417203046554, 0, 816.2670197447984, 0, 0, 1266.417203046554, 491.50706579294757, 0, 0,
        0, 1, 0,
      ],
    },
    sizeInBytes: 0,
  };

  const cam3: MessageEvent<Partial<CameraInfo>> = {
    topic: "/empty",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 1080,
      width: 1920,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/rational_polynomial": [cam1],
      "/none": [cam2],
      "/empty": [cam3],
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
          followTf: SENSOR_FRAME_ID,
          scene: { enableStats: false },
          cameraState: {
            distance: 1.25,
            perspective: true,
            phi: 0,
            targetOffset: [0, 0, 0],
            thetaOffset: 0,
            fovy: 0.75,
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/rational_polynomial": {
              color: "rgba(0, 255, 0, 1)",
              distance: 0.25,
            },
            "/none": {
              color: "rgba(0, 255, 255, 1)",
              distance: 0.5,
            },
            "/empty": {
              color: "rgba(255, 0, 0, 1)",
              distance: 0.75,
            },
          },
        }}
      />
    </PanelSetup>
  );
}

ImageRender.parameters = { colorScheme: "light" };
export function ImageRender(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/cam1/info", datatype: "sensor_msgs/CameraInfo" },
    { name: "/cam2/info", datatype: "sensor_msgs/CameraInfo" },
    { name: "/cam1/png", datatype: "sensor_msgs/CompressedImage" },
    { name: "/cam2/raw", datatype: "sensor_msgs/Image" },
  ];

  const tf1: MessageEvent<TF> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: FIXED_FRAME_ID },
      child_frame_id: BASE_LINK_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
      },
    },
    sizeInBytes: 0,
  };

  const cam1: MessageEvent<Partial<CameraInfo>> = {
    topic: "/cam1/info",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 480,
      width: 640,
      distortion_model: "rational_polynomial",
      D: [0.452407, 0.273748, -0.00011, 0.000152, 0.027904, 0.817958, 0.358389, 0.108657],
      K: [
        381.22076416015625, 0, 318.88323974609375, 0, 381.22076416015625, 233.90321350097656, 0, 0,
        1,
      ],
      R: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      P: [
        381.22076416015625, 0, 318.88323974609375, 0.015031411312520504, 0, 381.22076416015625,
        233.90321350097656, -0.00011014656047336757, 0, 0, 1, 0.000024338871298823506,
      ],
    },
    sizeInBytes: 0,
  };

  const cam2: MessageEvent<Partial<CameraInfo>> = {
    topic: "/cam2/info",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 900,
      width: 1600,
      distortion_model: "",
      D: [],
      K: [
        1266.417203046554, 0, 816.2670197447984, 0, 1266.417203046554, 491.50706579294757, 0, 0, 1,
      ],
      R: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      P: [
        1266.417203046554, 0, 816.2670197447984, 0, 0, 1266.417203046554, 491.50706579294757, 0, 0,
        0, 1, 0,
      ],
    },
    sizeInBytes: 0,
  };

  const cam1Png: MessageEvent<Partial<CompressedImage>> = {
    topic: "/cam1/png",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      format: "png",
      data: PNG_TEST_IMAGE,
    },
    sizeInBytes: 0,
  };

  // Create a Uint8Array 8x8 RGBA image
  const SIZE = 8;
  const rgba8 = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      rgba8[i + 0] = Math.trunc((x / (SIZE - 1)) * 255);
      rgba8[i + 1] = Math.trunc((y / (SIZE - 1)) * 255);
      rgba8[i + 2] = 0;
      rgba8[i + 3] = 255;
    }
  }

  const cam2Raw: MessageEvent<Partial<Image>> = {
    topic: "/cam2/raw",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: SIZE,
      width: SIZE,
      encoding: "rgba8",
      is_bigendian: false,
      step: SIZE * 4,
      data: rgba8,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/cam1/info": [cam1],
      "/cam2/info": [cam2],
      "/cam1/png": [cam1Png],
      "/cam2/raw": [cam2Raw],
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
          followTf: SENSOR_FRAME_ID,
          scene: { enableStats: false },
          cameraState: {
            distance: 1.5,
            perspective: true,
            phi: 0.975,
            targetOffset: [0, 0.4, 0],
            thetaOffset: 0,
            fovy: 0.75,
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/cam1/info": {
              color: "rgba(0, 255, 0, 1)",
              distance: 0.5,
            },
            "/cam2/info": {
              color: "rgba(0, 255, 255, 1)",
              distance: 0.25,
            },
            "/cam1/png": {
              color: "rgba(255, 255, 255, 1)",
              distance: 0.5,
            },
            "/cam2/raw": {
              color: "rgba(255, 255, 255, 0.75)",
              distance: 0.25,
            },
          },
        }}
      />
    </PanelSetup>
  );
}
