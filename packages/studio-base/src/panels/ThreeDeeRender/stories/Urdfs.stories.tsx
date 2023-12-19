// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { makeColor, STL_CUBE_MESH_RESOURCE } from "./common";
import ThreeDeePanel from "../index";

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

const URDF3 = `<?xml version="1.0"?>
<robot name="URDF Test3">
  <material name="base-sphere-material"><color rgba="${BLUE}"/></material>
  <material name="sphere-material"><color rgba="${RED}"/></material>
  <link name="base_link">
    <visual>
      <geometry><sphere radius="0.2"/></geometry>
      <material name="base-sphere-material"/>
    </visual>
  </link>
  <joint name="base_sphere_box_joint" type="fixed">
    <parent link="base_link"/>
    <child link="sphere_link"/>
    <origin rpy="0 0 0" xyz="0 0 0.3"/>
  </joint>
  <link name="sphere_link">
    <visual>
      <geometry><sphere radius="0.1"/></geometry>
      <material name="sphere-material"/>
    </visual>
  </link>
</robot>`;

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeePanel,
};

export const Urdfs: StoryObj = {
  render: function Story() {
    const topics: Topic[] = [
      { name: "/robot_description", schemaName: "std_msgs/String" },
      { name: "/tf_static", schemaName: "tf2_msgs/TFMessage" },
      { name: "/some/robot_description", schemaName: "std_msgs/String" },
    ];
    const robot_description: MessageEvent<{ data: string }> = {
      topic: "/robot_description",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        data: URDF,
      },
      schemaName: "std_msgs/String",
      sizeInBytes: 0,
    };
    const mesh_T_robot_1 = {
      header: {
        frame_id: "mesh-no-material",
      },
      child_frame_id: "robot_1/base_link",
      transform: {
        translation: {
          x: 0,
          y: -3,
          z: 0,
        },
        rotation: {
          w: 1,
        },
      },
    };
    const mesh_T_robot_2 = {
      ...mesh_T_robot_1,
      child_frame_id: "robot_2/base_link",
      transform: { ...mesh_T_robot_1.transform, translation: { x: 1, y: -1 } },
    };

    const urdfParamName = "/some_ns/robot_description";
    const fixture = {
      topics,
      frame: {
        "/robot_description": [
          robot_description,
          {
            topic: "/some/robot_description",
            schemaName: "std_msgs/String",
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 0,
            message: {
              data: URDF3,
            },
          },
        ],

        // Add transforms for the URDF instances that use a `framePrefix`, as these use the
        // same URDF and would otherwise displayed on top of each other.
        "/tf_static": [
          {
            topic: "/tf_static",
            schemaName: "tf2_msgs/TFMessage",
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 0,
            message: {
              transforms: [mesh_T_robot_1, mesh_T_robot_2],
            },
          },
        ],
      },
      capabilities: [],
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
        parameters: new Map([[urdfParamName, URDF3]]),
      },
    };

    return (
      <PanelSetup fixture={fixture}>
        <ThreeDeePanel
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
              urdfFromUrl: {
                layerId: "foxglove.Urdf",
                sourceType: "url",
                url: encodeURI(`data:text/xml;utf8,${URDF2}`),
              },
              urdfFromParameter: {
                layerId: "foxglove.Urdf",
                sourceType: "param",
                parameter: urdfParamName,
                framePrefix: `robot_1/`,
              },
              urdfFromTopic: {
                layerId: "foxglove.Urdf",
                sourceType: "topic",
                topic: "/some/robot_description",
                framePrefix: `robot_2/`,
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
  },

  parameters: { colorScheme: "dark" },
};

function makeColorAttribute(hex: string, alpha = 1): string {
  const c = makeColor(hex, alpha);
  return `${c.r} ${c.g} ${c.b} ${c.a}`;
}
