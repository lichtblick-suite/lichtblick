// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent, Topic } from "@foxglove/studio";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { DEFAULT_CAMERA_STATE } from "../camera";
import ThreeDeeRender from "../index";
import { Marker } from "../ros";
import { makeColor, OBJ_CUBE_MESH_RESOURCE, STL_CUBE_MESH_RESOURCE } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

MeshMarkers.parameters = { colorScheme: "dark" };
export function MeshMarkers(): JSX.Element {
  const topics: Topic[] = [{ name: "/markers", datatype: "visualization_msgs/Marker" }];

  const stlMesh: MessageEvent<Marker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
      id: 0,
      ns: "stl",
      type: 10,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 0, y: -1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      color: makeColor("#8bc34a", 0.5),
      points: [],
      colors: [],
      text: "",
      mesh_resource: STL_CUBE_MESH_RESOURCE,
      mesh_use_embedded_materials: true,
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const stlColoredMesh = {
    ...stlMesh,
    message: {
      ...stlMesh.message,
      id: 1,
      mesh_use_embedded_materials: false,
      pose: { position: { x: -1, y: 0, z: 0 }, orientation: stlMesh.message.pose.orientation },
    },
  };

  const objMesh: MessageEvent<Marker> = {
    topic: "/markers",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
      id: 0,
      ns: "obj",
      type: 10,
      action: 0,
      frame_locked: false,
      pose: {
        position: { x: 1, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0.25, y: 0.25, z: 0.25 },
      color: makeColor("#ff0000"),
      points: [],
      colors: [],
      text: "",
      mesh_resource: OBJ_CUBE_MESH_RESOURCE,
      mesh_use_embedded_materials: true,
      lifetime: { sec: 0, nsec: 0 },
    },
    schemaName: "visualization_msgs/Marker",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: { "/markers": [stlMesh, stlColoredMesh, objMesh] },
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
          cameraState: { ...DEFAULT_CAMERA_STATE, distance: 5, thetaOffset: 50 },
          topics: {
            "/markers": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}
