import { jsx as _jsx } from "react/jsx-runtime";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import { makeColor } from "./common";
import ThreeDeePanel from "../index";
const GREEN = makeColorAttribute("#4caf50");
const BLUE = makeColorAttribute("#2196f3");
const RED = makeColorAttribute("#f44336");
const URDF = `<?xml version="1.0"?>
<robot name="URDF Test3">
  <material name="base-sphere-material"><color rgba="${BLUE}"/></material>
  <material name="sphere-material"><color rgba="${GREEN}"/></material>
  <material name="top-sphere-material"><color rgba="${RED}"/></material>
  <link name="base_link">
    <visual>
      <geometry><sphere radius="0.3"/></geometry>
      <material name="base-sphere-material"/>
    </visual>
    <collision>
      <geometry><box size="0.6 0.6 0.6"/></geometry>
    </collision>
  </link>
  <joint name="base_sphere_box_joint" type="fixed">
    <parent link="base_link"/>
    <child link="sphere_link"/>
    <origin rpy="0 0 0" xyz="0 0 0.5"/>
  </joint>
  <link name="sphere_link">
    <visual>
      <geometry><sphere radius="0.2"/></geometry>
      <material name="sphere-material"/>
    </visual>
    <collision>
      <geometry><box size="0.4 0.4 0.4"/></geometry>
    </collision>
  </link>
  <joint name="sphere_top_joint" type="fixed">
    <parent link="sphere_link"/>
    <child link="sphere_top_link_collision_only"/>
    <origin rpy="0 0 0" xyz="0 0 0.3"/>
  </joint>
  <link name="sphere_top_link_collision_only">
    <collision>
      <geometry><box size="0.2 0.2 0.2"/></geometry>
    </collision>
  </link>
</robot>`;
export default {
    title: "panels/ThreeDeeRender",
    component: ThreeDeePanel,
};
export const UrdfDisplayMode = {
    render: function Story() {
        const topics = [{ name: "/tf_static", schemaName: "tf2_msgs/TFMessage" }];
        const mesh_T_robot = {
            header: {
                frame_id: "mesh-no-material",
            },
            child_frame_id: "",
            transform: {
                rotation: {
                    w: 1,
                },
            },
        };
        const urdfParamName = "/some_ns/robot_description";
        const urdfDisplays = {
            urdf1: {
                sourceType: "param",
                parameter: urdfParamName,
                layerId: "foxglove.Urdf",
                framePrefix: "display_auto/",
                displayMode: "auto",
                translation: { x: -2, y: 0, z: 0 },
            },
            urdf2: {
                sourceType: "param",
                parameter: urdfParamName,
                layerId: "foxglove.Urdf",
                framePrefix: "display_visual/",
                displayMode: "visual",
                translation: { x: 0, y: 0, z: 0 },
            },
            urdf3: {
                sourceType: "param",
                parameter: urdfParamName,
                layerId: "foxglove.Urdf",
                framePrefix: "display_collision/",
                displayMode: "collision",
                translation: { x: 2, y: 0, z: 0 },
            },
            urdf4: {
                sourceType: "param",
                parameter: urdfParamName,
                layerId: "foxglove.Urdf",
                framePrefix: "display_collision_colored/",
                displayMode: "collision",
                translation: { x: 4, y: 0, z: 0 },
                fallbackColor: "#eb34d8",
            },
        };
        const fixture = {
            topics,
            capabilities: [],
            frame: {
                "/tf_static": [
                    // Add transforms for the URDF instances that use a `framePrefix`, as these use the
                    // same URDF and would otherwise displayed on top of each other.
                    {
                        topic: "/tf_static",
                        schemaName: "tf2_msgs/TFMessage",
                        receiveTime: { sec: 0, nsec: 0 },
                        sizeInBytes: 0,
                        message: {
                            transforms: Object.values(urdfDisplays).map((e) => ({
                                ...mesh_T_robot,
                                child_frame_id: `${e.framePrefix}base_link`,
                                transform: { ...mesh_T_robot.transform, translation: e.translation },
                            })),
                        },
                    },
                ],
            },
            activeData: {
                currentTime: { sec: 0, nsec: 0 },
                parameters: new Map([[urdfParamName, URDF]]),
            },
        };
        return (_jsx(PanelSetup, { fixture: fixture, children: _jsx(ThreeDeePanel, { overrideConfig: {
                    scene: {
                        transforms: {
                            axisScale: 3,
                            labelSize: 0.15,
                        },
                    },
                    layers: {
                        grid: {
                            layerId: "foxglove.Grid",
                            position: [0, 0, 0],
                        },
                        ...urdfDisplays,
                    },
                    cameraState: {
                        distance: 6,
                    },
                } }) }));
    },
    parameters: { colorScheme: "dark" },
};
function makeColorAttribute(hex, alpha = 1) {
    const c = makeColor(hex, alpha);
    return `${c.r} ${c.g} ${c.b} ${c.a}`;
}
