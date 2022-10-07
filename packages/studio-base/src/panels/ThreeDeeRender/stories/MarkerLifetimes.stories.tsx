// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { TransformStamped } from "../ros";
import { makeFail, makePass, QUAT_IDENTITY, rad2deg, TEST_COLORS, VEC3_ZERO } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

MarkerLifetimes.parameters = { colorScheme: "dark" };
export function MarkerLifetimes(): JSX.Element {
  const topics: Topic[] = [
    { name: "/markers", schemaName: "visualization_msgs/Marker" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 1, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: VEC3_ZERO,
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: -1, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const pass1 = makePass({
    id: 1,
    frame_id: "base_link",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_GREEN1,
    pose: { position: { x: -1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });
  const pass2 = makePass({
    id: 2,
    frame_id: "sensor",
    stamp: fromSec(2),
    colorHex: TEST_COLORS.MARKER_GREEN2,
    pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });
  const pass3 = makePass({
    receiveTime: { sec: 1, nsec: 0 },
    id: 3,
    frame_id: "sensor",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_GREEN3,
    lifetime: { sec: 1, nsec: 0 },
    pose: { position: { x: 2, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
  });

  const pass4 = makePass({
    id: 4,
    frame_id: "base_link",
    stamp: fromSec(0),
    colorHex: TEST_COLORS.MARKER_GREEN1,
    pose: { position: { x: -1, y: -1, z: 0 }, orientation: QUAT_IDENTITY },
    // Even though there is no transform from base_link to map at t0, we clamp
    // to the earliest available transform and render with that
  });
  const pass5 = makePass({
    id: 5,
    frame_id: "base_link",
    stamp: fromSec(3),
    colorHex: TEST_COLORS.MARKER_GREEN2,
    pose: { position: { x: 0, y: -1, z: 0 }, orientation: QUAT_IDENTITY },
    // Even though t3 is ahead of currentTime (t2), we clamp to the latest
    // available transform and render with that
  });
  const pass6 = makePass({
    receiveTime: { sec: 2, nsec: -1 },
    id: 6,
    frame_id: "base_link",
    stamp: fromSec(0),
    colorHex: TEST_COLORS.MARKER_GREEN3,
    lifetime: { sec: 0, nsec: 1 },
    pose: { position: { x: 1, y: -1, z: 0 }, orientation: QUAT_IDENTITY },
    // Expires now, this is the last nanosecond it will be shown
  });
  const fail1 = makeFail({
    id: 1,
    frame_id: "missing",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_RED1,
    pose: { position: { x: -1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
    description: `No transform(s) for coordinate frame "missing"`,
  });
  const fail2 = makeFail({
    receiveTime: { sec: 1, nsec: 0 },
    id: 2,
    frame_id: "sensor",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_RED2,
    lifetime: { sec: 0, nsec: 1 },
    pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
    description: `Expired at t1:1, currentTime is t2`,
  });
  const fail3 = makeFail({
    receiveTime: { sec: 1, nsec: 0 },
    id: 3,
    frame_id: "sensor",
    stamp: fromSec(1),
    colorHex: TEST_COLORS.MARKER_RED3,
    lifetime: { sec: 1, nsec: -1 },
    pose: { position: { x: 2, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
    description: `Expired 1ns ago (t1 + 1s - 1ns)`,
  });
  const fail4 = makeFail({
    receiveTime: { sec: 2, nsec: -2 },
    id: 6,
    frame_id: "base_link",
    stamp: fromSec(0),
    colorHex: TEST_COLORS.MARKER_GREEN3,
    lifetime: { sec: 0, nsec: 1 },
    pose: { position: { x: -1, y: -1, z: 0 }, orientation: QUAT_IDENTITY },
    description: `Expired 1ns ago (t2 - 2ns + 1ns)`,
  });

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/markers": [pass1, pass2, pass3, pass4, pass5, pass6, fail1, fail2, fail3, fail4],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 2, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          ...ThreeDeeRender.defaultConfig,
          followTf: "base_link",
          cameraState: {
            distance: 3,
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
}
