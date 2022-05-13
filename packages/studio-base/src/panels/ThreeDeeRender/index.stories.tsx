// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent, Topic } from "@foxglove/studio";
import useDelayedFixture from "@foxglove/studio-base/panels/ThreeDimensionalViz/stories/useDelayedFixture";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { hexToColorObj } from "@foxglove/studio-base/util/colorUtils";

import ThreeDeeRender from "./index";
import { CameraInfo, Marker, PoseStamped, PoseWithCovarianceStamped, TF } from "./ros";

const QUAT_IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

function makeColor(hex: string, alpha?: number) {
  return hexToColorObj(hex, alpha);
}

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

const SENSOR_FRAME_ID = "base_link";
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
      child_frame_id: "sensor",
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      child_frame_id: SENSOR_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      child_frame_id: "sensor",
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
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
      child_frame_id: SENSOR_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      child_frame_id: "sensor",
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
      child_frame_id: SENSOR_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      child_frame_id: "sensor",
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      child_frame_id: SENSOR_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      child_frame_id: "sensor",
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
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
          followTf: "sensor",
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
