// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useState } from "react";
import URDFLoader from "urdf-loader";
import { v4 as uuidv4 } from "uuid";

import AssetsContext from "@foxglove/studio-base/context/AssetsContext";
import URDFViewer from "@foxglove/studio-base/panels/URDFViewer";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { JointState } from "@foxglove/studio-base/types/Messages";

export default {
  title: "panels/URDFViewer",
  component: URDFViewer,
};

function ExampleAssetsProvider({ children }: React.PropsWithChildren<unknown>) {
  const [assets] = useState(() => {
    return [
      {
        type: "urdf",
        name: "example.urdf",
        uuid: uuidv4(),
        model: new URDFLoader().parse(exampleURDF),
      },
    ] as const;
  });
  const loadFromFile = useCallback(async () => {
    throw new Error("not supported in storybook");
  }, []);
  return (
    <AssetsContext.Provider value={{ assets, loadFromFile }}>{children}</AssetsContext.Provider>
  );
}

export function Default(): JSX.Element {
  return (
    <ExampleAssetsProvider>
      <PanelSetup>
        <URDFViewer />
      </PanelSetup>
    </ExampleAssetsProvider>
  );
}

export function CustomOpacity(): JSX.Element {
  return (
    <ExampleAssetsProvider>
      <PanelSetup>
        <URDFViewer overrideConfig={{ opacity: 0.25 }} />
      </PanelSetup>
    </ExampleAssetsProvider>
  );
}

export function JointPositionFromTopic(): JSX.Element {
  const jointStates: MessageEvent<JointState> = {
    topic: "/joint_states",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      header: { frame_id: "", seq: 0, stamp: { sec: 0, nsec: 0 } },
      name: ["base_rotation"],
      position: [1],
      velocity: [0],
      effort: [0],
    },
  };
  return (
    <ExampleAssetsProvider>
      <PanelSetup
        fixture={{
          topics: [{ name: "/joint_states", datatype: "sensor_msgs/JointState" }],
          frame: { "/joint_states": [jointStates] },
        }}
      >
        <URDFViewer />
      </PanelSetup>
    </ExampleAssetsProvider>
  );
}

export function ManualJointPosition(): JSX.Element {
  return (
    <ExampleAssetsProvider>
      <PanelSetup>
        <URDFViewer
          overrideConfig={{ jointStatesTopic: undefined, customJointValues: { base_rotation: 1 } }}
        />
      </PanelSetup>
    </ExampleAssetsProvider>
  );
}

const exampleURDF = `
<?xml version="1.0"?>
<robot>
  <material name="blue"><color rgba="0 0 0.8 1"/></material>
  <material name="white"><color rgba="1 1 1 1"/></material>


  <link name="base_link">
    <visual>
      <geometry>
        <cylinder length="0.1" radius="0.4"/>
      </geometry>
      <material name="blue"/>
    </visual>
  </link>

  <link name="knob">
    <visual>
      <geometry>
        <cylinder length="0.1" radius="0.1" size="0.6 0.1 0.2"/>
      </geometry>
      <origin xyz="0.3 0 0.1"/>
      <material name="white"/>
    </visual>
  </link>

  <joint name="base_rotation" type="continuous">
    <parent link="base_link"/>
    <child link="knob"/>
    <axis xyz="0 0 1"/>
  </joint>

</robot>
`.trim();
