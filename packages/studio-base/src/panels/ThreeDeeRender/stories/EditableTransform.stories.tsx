// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import type { FrameTransform } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { eulerToQuaternion } from "@foxglove/studio-base/util/geometry";

import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";
import ThreeDeePanel from "../index";

const VEC3_ZERO = { x: 0, y: 0, z: 0 };

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeePanel,
};

function normalToQuaternion(x: number, y: number, z: number) {
  const heading = Math.atan2(y, x);
  const pitch = -Math.asin(z);
  return eulerToQuaternion({ x: 0, y: pitch, z: heading });
}

function makeTransformGroup(
  radius = 1.5,
  steps = 20,
  parentFrameId: (step: number) => string = (_step) => "base_link",
) {
  const a = 8;
  const tfs = [];
  for (let step = 0; step < steps; step++) {
    const angle = Math.PI * (step / steps);

    // spiral sphere
    const xNormal = Math.sin(angle) * Math.cos(a * angle);
    const yNormal = Math.sin(angle) * Math.sin(a * angle);
    const zNormal = Math.cos(angle);
    const x = xNormal * radius;
    const y = yNormal * radius;
    const z = zNormal * radius;

    tfs.push({
      topic: "/tf",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 1, nsec: 0 },
        parent_frame_id: parentFrameId(step),
        child_frame_id: `${parentFrameId(step)}->${step}`,
        translation: {
          x,
          y,
          z,
        },
        rotation: normalToQuaternion(xNormal, yNormal, zNormal),
      },
      schemaName: "foxglove.FrameTransform",
      sizeInBytes: 0,
    });
  }

  return tfs;
}

export const EditableTransformRedInBlueDown: StoryObj = {
  render: function Story() {
    const topics: Topic[] = [{ name: "/tf", schemaName: "foxglove.FrameTransform" }];
    const root: MessageEvent<FrameTransform> = {
      topic: "/tf",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 1, nsec: 0 },
        parent_frame_id: "root",
        child_frame_id: "base_link",
        translation: VEC3_ZERO,
        rotation: QUAT_IDENTITY,
      },
      schemaName: "foxglove.FrameTransform",
      sizeInBytes: 0,
    };

    const spiralTfs = makeTransformGroup(2, 50);

    const rpyCoefficients = spiralTfs.reduce<
      Record<string, { rpyCoefficient: [number, number, number] }>
    >((acc, tf) => {
      const tfName = `frame:${tf.message.child_frame_id}`;
      acc[tfName] = {
        rpyCoefficient: [180, 0, 180],
      };
      return acc;
    }, {});

    const fixture = useDelayedFixture({
      topics,
      frame: {
        "/tf": [root, ...spiralTfs],
      },
      capabilities: [],
      activeData: {
        currentTime: { sec: 2, nsec: 0 },
      },
    });

    return (
      <PanelSetup fixture={fixture} includeSettings={true}>
        <ThreeDeePanel
          overrideConfig={{
            followTf: "root",
            layers: {
              grid: {
                layerId: "foxglove.Grid",
                position: [0, 0, -0.25],
              },
            },
            scene: {
              transforms: {
                editable: true,
                showLabel: false,
              },
            },
            transforms: {
              ...rpyCoefficients,
            },
            cameraState: {
              distance: 6,
              perspective: true,
              phi: rad2deg(1),
              targetOffset: [0, 0, 0],
              thetaOffset: rad2deg(0),
              fovy: rad2deg(0.75),
              near: 0.01,
              far: 5000,
              target: [0, 0, 0],
              targetOrientation: [0, 0, 0, 1],
            },
            topics: {
              "/markers": { visible: true },
            },
          }}
        />
      </PanelSetup>
    );
  },

  parameters: { colorScheme: "dark" },
};
