// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent, Topic } from "@foxglove/studio";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import delay from "@foxglove/studio-base/util/delay";

import ThreeDeeRender from "../index";
import { PublishClickType } from "../renderables/PublishClickTool";
import { TransformStamped } from "../ros";
import { QUAT_IDENTITY } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender/PublishClickTool",
  component: ThreeDeeRender,
};

export const Point = Object.assign(PublishClickToolTemplate.bind({}), {
  parameters: { colorScheme: "dark", chromatic: { delay: 200 } },
  args: { type: "point" },
  play: async () => {
    document.querySelector<HTMLElement>("[data-test=publish-button]")!.click();
    await delay(100);
    const canvas = document.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 400 }));
  },
});

export const PosePosition = Object.assign(PublishClickToolTemplate.bind({}), {
  parameters: { colorScheme: "dark", chromatic: { delay: 200 } },
  args: { type: "pose" },
  play: async () => {
    document.querySelector<HTMLElement>("[data-test=publish-button]")!.click();
    await delay(100);
    const canvas = document.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 400 }));
  },
});

export const PoseComplete = Object.assign(PublishClickToolTemplate.bind({}), {
  parameters: { colorScheme: "dark", chromatic: { delay: 200 } },
  args: { type: "pose" },
  play: async () => {
    document.querySelector<HTMLElement>("[data-test=publish-button]")!.click();
    await delay(100);
    const canvas = document.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 400 }));
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 400 }));
    canvas.dispatchEvent(new MouseEvent("click", { clientX: 400, clientY: 400 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 500, clientY: 300 }));
  },
});

export const PoseEstimatePosition = Object.assign(PublishClickToolTemplate.bind({}), {
  parameters: { colorScheme: "dark", chromatic: { delay: 200 } },
  args: { type: "pose_estimate" },
  play: async () => {
    document.querySelector<HTMLElement>("[data-test=publish-button]")!.click();
    await delay(100);
    const canvas = document.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 400 }));
  },
});

export const PoseEstimateComplete = Object.assign(PublishClickToolTemplate.bind({}), {
  parameters: { colorScheme: "dark", chromatic: { delay: 200 } },
  args: { type: "pose_estimate" },
  play: async () => {
    document.querySelector<HTMLElement>("[data-test=publish-button]")!.click();
    await delay(100);
    const canvas = document.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 400 }));
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 400 }));
    canvas.dispatchEvent(new MouseEvent("click", { clientX: 400, clientY: 400 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 500, clientY: 300 }));
  },
});

function PublishClickToolTemplate({ type }: { type: PublishClickType }): JSX.Element {
  const topics: Topic[] = [{ name: "/tf", datatype: "geometry_msgs/TransformStamped" }];
  const tf1: MessageEvent<TransformStamped> = {
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

  const fixture = useDelayedFixture({
    topics,
    frame: { "/tf": [tf1] },
    capabilities: [PlayerCapabilities.advertise],
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
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          publish: { type },
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
