// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { makeColor, STL_CUBE_MESH_RESOURCE } from "./common";
import useDelayedFixture from "./useDelayedFixture";

const RED = makeColorAttribute("#f44336");
const GREEN = makeColorAttribute("#4caf50");
const BLUE = makeColorAttribute("#2196f3");
const YELLOW = makeColorAttribute("#ffeb3b");

const URDF = `<?xml version="1.0"?>
<robot name="URDF Test2">
  <joint name="mesh-no-material_T_layer" type="fixed">
    <parent link="mesh-no-material"/>
    <child link="layer"/>
    <origin xyz="1 -2 0"/>
  </joint>
</robot>`;

const URDF2 = `<?xml version="1.0"?>
<robot name="URDF Test">
  <material name="box-material"><color rgba="${RED}"/></material>
  <material name="cylinder-material"><color rgba="${GREEN}"/></material>
  <material name="sphere-material"><color rgba="${BLUE}"/></material>
  <material name="mesh-material"><color rgba="${YELLOW}"/></material>

  <link name="box">
    <visual>
      <geometry><box size="1 0.5 0.025"/></geometry>
      <origin rpy="0 0 0" xyz="0 0 0"/>
      <material name="box-material"/>
    </visual>
  </link>

  <link name="cylinder">
    <visual>
      <geometry><cylinder length="2" radius="0.2"/></geometry>
      <origin rpy="0 1.5708 0" xyz="0 0 0"/>
      <material name="cylinder-material"/>
    </visual>
  </link>

  <joint name="box_T_cylinder" type="fixed">
    <parent link="box"/>
    <child link="cylinder"/>
    <origin rpy="0 0 0.785398" xyz="0 2 0"/>
  </joint>

  <link name="sphere">
    <visual>
      <geometry><sphere radius="0.2"/></geometry>
      <origin rpy="0 0 0" xyz="0 0 0"/>
      <material name="sphere-material"/>
    </visual>
  </link>

  <joint name="cylinder_T_sphere" type="fixed">
    <parent link="cylinder"/>
    <child link="sphere"/>
    <origin rpy="0 0 0" xyz="-0.70710678118 0.70710678118 0"/>
  </joint>

  <link name="mesh">
    <visual>
      <geometry><mesh filename="${STL_CUBE_MESH_RESOURCE}" scale="0.25 0.25 -0.1" /></geometry>
      <origin rpy="1.5708 0 0" xyz="0 0 0"/>
      <material name="mesh-material"/>
    </visual>
  </link>

  <joint name="box_T_mesh" type="fixed">
    <parent link="box"/>
    <child link="mesh"/>
    <origin rpy="0 0 0" xyz="1 1 0"/>
  </joint>

  <link name="mesh-no-material">
    <visual>
      <geometry><mesh filename="${STL_CUBE_MESH_RESOURCE}" scale="0.25 0.25 0.5"/></geometry>
      <origin rpy="0 0 0" xyz="0 0 -0.25"/>
    </visual>
  </link>

  <joint name="mesh_T_mesh-no-material" type="fixed">
    <parent link="mesh"/>
    <child link="mesh-no-material"/>
    <origin rpy="0 0 0" xyz="1 2 0"/>
  </joint>
</robot>`;

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

Urdfs.parameters = { colorScheme: "dark" };
export function Urdfs(): JSX.Element {
  const topics: Topic[] = [{ name: "/robot_description", schemaName: "std_msgs/String" }];
  const robot_description: MessageEvent<{ data: string }> = {
    topic: "/robot_description",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      data: URDF,
    },
    schemaName: "std_msgs/String",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/robot_description": [robot_description],
    },
    capabilities: [],
    activeData: {
      currentTime: undefined,
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          scene: {
            transforms: {
              axisScale: 3,
            },
          },
          layers: {
            grid: {
              layerId: "foxglove.Grid",
              position: [0, 0, 0],
            },
            urdf: {
              layerId: "foxglove.Urdf",
              url: encodeURI(`data:text/xml;utf8,${URDF2}`),
            },
          },
          cameraState: {
            distance: 6,
          },
          topics: {
            "/robot_description": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}

function makeColorAttribute(hex: string, alpha = 1): string {
  const c = makeColor(hex, alpha);
  return `${c.r} ${c.g} ${c.b} ${c.a}`;
}
