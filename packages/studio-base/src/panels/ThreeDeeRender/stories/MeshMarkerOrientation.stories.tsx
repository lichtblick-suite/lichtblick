// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { DEFAULT_CAMERA_STATE } from "../camera";
import ThreeDeeRender from "../index";
import { Marker } from "../ros";
import {
  COLLADA_AXES_MESH_RESOURCE,
  GLTF_AXES_MESH_RESOURCE,
  OBJ_AXES_MESH_RESOURCE,
  STL_AXES_MESH_RESOURCE,
} from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

MeshMarkerOrientation.parameters = { colorScheme: "dark" };
export function MeshMarkerOrientation(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/labels", schemaName: "visualization_msgs/Marker" },
  ];

  const baseMeshMarker: MessageEvent<Marker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
      id: 0,
      ns: "",
      type: 10,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 1, y: 1, z: 1 },
      color: { r: 1, g: 1, b: 1, a: 1 },
      points: [],
      colors: [],
      text: "",
      mesh_resource: "",
      mesh_use_embedded_materials: true,
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const baseLabel: MessageEvent<Marker> = {
    topic: "/labels",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
      id: 0,
      ns: "",
      type: 9,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0, y: 0, z: 0.2 },
      color: { r: 1, g: 1, b: 1, a: 1 },
      points: [],
      colors: [],
      text: "",
      mesh_resource: "",
      mesh_use_embedded_materials: false,
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const glbMesh = {
    ...baseMeshMarker,
    message: {
      ...baseMeshMarker.message,
      ns: "glb",
      pose: { position: { x: -2, y: 0, z: 0.25 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      mesh_resource: GLTF_AXES_MESH_RESOURCE,
    },
  };

  const daeMesh = {
    ...baseMeshMarker,
    message: {
      ...baseMeshMarker.message,
      ns: "dae",
      pose: { position: { x: 0, y: 0, z: 0.25 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      mesh_resource: COLLADA_AXES_MESH_RESOURCE,
    },
  };

  const stlMesh: MessageEvent<Marker> = {
    ...baseMeshMarker,
    message: {
      ...baseMeshMarker.message,
      ns: "stl",
      pose: { position: { x: 2, y: 0, z: 0.25 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      mesh_resource: STL_AXES_MESH_RESOURCE,
    },
  };

  const objMesh: MessageEvent<Marker> = {
    ...baseMeshMarker,
    message: {
      ...baseMeshMarker.message,
      ns: "obj",
      pose: { position: { x: 4, y: 0, z: 0.25 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      mesh_resource: OBJ_AXES_MESH_RESOURCE,
    },
  };

  const glbLabel = {
    ...baseLabel,
    message: {
      ...baseLabel.message,
      ns: "glb",
      pose: { position: { x: -2, y: -1, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      text: "glTF",
    },
  };

  const daeLabel = {
    ...baseLabel,
    message: {
      ...baseLabel.message,
      ns: "dae",
      pose: { position: { x: 0, y: -1, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      text: "COLLADA",
    },
  };

  const stlLabel = {
    ...baseLabel,
    message: {
      ...baseLabel.message,
      ns: "stl",
      pose: { position: { x: 2, y: -1, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      text: "STL",
    },
  };

  const objLabel = {
    ...baseLabel,
    message: {
      ...baseLabel.message,
      ns: "obj",
      pose: { position: { x: 4, y: -1, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      text: "OBJ",
    },
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/markers": [glbMesh, daeMesh, stlMesh, objMesh],
      "/labels": [glbLabel, daeLabel, stlLabel, objLabel],
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
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          scene: {
            transforms: {
              showLabel: false,
            },
          },
          cameraState: { ...DEFAULT_CAMERA_STATE, distance: 6, thetaOffset: 50 },
          topics: {
            "/markers": { visible: true },
            "/labels": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}
