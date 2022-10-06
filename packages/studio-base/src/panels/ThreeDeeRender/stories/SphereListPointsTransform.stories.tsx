// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DeepWritable } from "ts-essentials";

import { MessageEvent, Topic } from "@foxglove/studio";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { SphereListMarker } from "@foxglove/studio-base/types/Messages";

import ThreeDeeRender from "../index";
import { TransformStamped } from "../ros";
import { makeColor, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

SphereListPointsTransform.parameters = { colorScheme: "dark" };
export function SphereListPointsTransform(): JSX.Element {
  function makeSphere(
    id: string,
    color: string,
    scale: number,
  ): MessageEvent<DeepWritable<SphereListMarker>> {
    return {
      topic: "/sphere",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "camera_color_optical_frame" },
        id,
        ns: "",
        type: 7,
        action: 0,
        frame_locked: false,
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
        points: [
          {
            x: 0,
            y: 0,
            z: 0,
          },
        ],
        scale: { x: scale, y: scale, z: scale },
        color: makeColor(color, 1),
        lifetime: { sec: 0, nsec: 0 },
      },
      schemaName: "visualization_msgs/Marker",
      sizeInBytes: 0,
    };
  }

  const topics: Topic[] = [
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
    { name: "/sphere", datatype: "visualization_msgs/Marker" },
  ];

  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "camera_link" },
      child_frame_id: "camera_color_optical_frame",
      transform: {
        translation: { x: 0.5, y: -0.5, z: 0 },
        rotation: {
          x: -0.5,
          y: 0.5,
          z: -0.5,
          w: 0.5,
        },
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const sphere1 = makeSphere("sphere1", "#ff0000", 0.1);
  sphere1.message.pose.position.x = 0.5;

  const sphere2 = makeSphere("sphere2", "#00ff00", 0.1);
  sphere2.message.pose.position.y = 0.5;

  const sphere3 = makeSphere("sphere3", "#0000ff", 0.1);
  sphere3.message.pose.position.z = 0.5;

  const sphere4 = makeSphere("sphere4", "#ff0000", 0.2);
  sphere4.message.points[0]!.x = 0.75;

  const sphere5 = makeSphere("sphere5", "#00ff00", 0.2);
  sphere5.message.points[0]!.y = 0.75;

  const sphere6 = makeSphere("sphere6", "#0000ff", 0.2);
  sphere6.message.points[0]!.z = 0.75;

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1],
      "/sphere": [sphere1, sphere2, sphere3, sphere4, sphere5, sphere6],
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
          followTf: "camera_link",
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 4,
            perspective: true,
            phi: rad2deg(1.2),
            targetOffset: [0.5, 0, 0],
            thetaOffset: rad2deg(-0.5),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/sphere": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}
