// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DEFAULT_CAMERA_STATE } from "@foxglove/regl-worldview";
import { MessageEvent, Topic } from "@foxglove/studio";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { Marker } from "../ros";
import { makeColor, STL_CUBE_MESH_RESOURCE } from "./common";
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
      mesh_resource: encodeURI(`data:model/obj;utf8,o Cube
v 1.000000 -1.000000 -1.000000 0 1 0
v 1.000000 -1.000000 1.000000 0 1 1
v -1.000000 -1.000000 1.000000 0 0 1
v -1.000000 -1.000000 -1.000000 1 1 0
v 1.000000 1.000000 -0.999999 0 1 1
v 0.999999 1.000000 1.000001 1 0 1
v -1.000000 1.000000 1.000000 1 0 0
v -1.000000 1.000000 -1.000000 0 1 0
vt 1.000000 0.333333
vt 1.000000 0.666667
vt 0.666667 0.666667
vt 0.666667 0.333333
vt 0.666667 0.000000
vt 0.000000 0.333333
vt 0.000000 0.000000
vt 0.333333 0.000000
vt 0.333333 1.000000
vt 0.000000 1.000000
vt 0.000000 0.666667
vt 0.333333 0.333333
vt 0.333333 0.666667
vt 1.000000 0.000000
vn 0.000000 -1.000000 0.000000
vn 0.000000 1.000000 0.000000
vn 1.000000 0.000000 0.000000
vn -0.000000 0.000000 1.000000
vn -1.000000 -0.000000 -0.000000
vn 0.000000 0.000000 -1.000000
usemtl Material
s off
f 2/1/1 3/2/1 4/3/1
f 8/1/2 7/4/2 6/5/2
f 5/6/3 6/7/3 2/8/3
f 6/8/4 7/5/4 3/4/4
f 3/9/5 7/10/5 8/11/5
f 1/12/6 4/13/6 8/11/6
f 1/4/1 2/1/1 4/3/1
f 5/14/2 8/1/2 6/5/2
f 1/12/3 5/6/3 2/8/3
f 2/12/4 6/8/4 3/4/4
f 4/13/5 3/9/5 8/11/5
f 5/6/6 1/12/6 8/11/6`),
      mesh_use_embedded_materials: true,
      lifetime: { sec: 0, nsec: 0 },
    },
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
          cameraState: { ...DEFAULT_CAMERA_STATE, distance: 5, thetaOffset: 1 },
        }}
      />
    </PanelSetup>
  );
}
