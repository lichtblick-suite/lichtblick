// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";

import { isStaticTransformTopic, mergeStaticTransforms } from "./staticTransforms";

function transform(parent: string, child: string, x: number) {
  return {
    header: { stamp: { sec: 0, nsec: 0 }, frame_id: parent },
    child_frame_id: child,
    transform: { translation: { x, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
  };
}

function tfStatic(transforms: ReturnType<typeof transform>[], sizeInBytes = 100): MessageEvent {
  return {
    topic: "/tf_static",
    receiveTime: { sec: 1, nsec: 0 },
    schemaName: "tf2_msgs/msg/TFMessage",
    sizeInBytes,
    message: { transforms },
  };
}

describe("isStaticTransformTopic", () => {
  it("should be true when the topic is /tf_static or a namespaced tf_static", () => {
    // GIVEN / WHEN / THEN
    expect(isStaticTransformTopic("/tf_static")).toBe(true);
    expect(isStaticTransformTopic("/robot/tf_static")).toBe(true);
  });

  it("should be false when the topic is /tf or only starts like tf_static", () => {
    // GIVEN / WHEN / THEN
    expect(isStaticTransformTopic("/tf")).toBe(false);
    expect(isStaticTransformTopic("/tf_static_debug")).toBe(false);
  });
});

describe("mergeStaticTransforms", () => {
  it("should keep the transforms of an earlier publisher when another publisher sends other frames", () => {
    // GIVEN - the jig tree from one publisher, then the camera frame from another
    const jig = tfStatic([transform("base", "jig", 1)]);
    const camera = tfStatic([transform("cam", "cam_optical", 2)]);

    // WHEN
    const merged = mergeStaticTransforms(jig, camera);

    // THEN - both frames are in the cached message
    const children = (
      merged.message as { transforms: { child_frame_id: string }[] }
    ).transforms.map((t) => t.child_frame_id);
    expect(children.sort()).toEqual(["cam_optical", "jig"]);
  });

  it("should take the newer transform when the same child frame is sent again", () => {
    // GIVEN
    const before = tfStatic([transform("base", "jig", 1)]);
    const after = tfStatic([transform("base", "jig", 5)]);

    // WHEN
    const merged = mergeStaticTransforms(before, after);

    // THEN
    expect(merged).toBe(after);
  });

  it("should return the new message when there is nothing cached", () => {
    // GIVEN
    const camera = tfStatic([transform("cam", "cam_optical", 2)]);

    // WHEN / THEN
    expect(mergeStaticTransforms(undefined, camera)).toBe(camera);
  });

  it("should return the new message when either message has no transforms array", () => {
    // GIVEN
    const jig = tfStatic([transform("base", "jig", 1)]);
    const other: MessageEvent = { ...jig, message: { data: 1 } };

    // WHEN / THEN
    expect(mergeStaticTransforms(jig, other)).toBe(other);
    expect(mergeStaticTransforms(other, jig)).toBe(jig);
  });

  it("should keep the newer receive time and schema and add up the kept sizes when merging", () => {
    // GIVEN
    const jig = tfStatic([transform("base", "jig", 1)], 100);
    const camera = {
      ...tfStatic([transform("cam", "cam_optical", 2)], 60),
      receiveTime: { sec: 2, nsec: 0 },
    };

    // WHEN
    const merged = mergeStaticTransforms(jig, camera);

    // THEN
    expect(merged.receiveTime).toEqual({ sec: 2, nsec: 0 });
    expect(merged.schemaName).toBe("tf2_msgs/msg/TFMessage");
    expect(merged.sizeInBytes).toBe(160);
  });
});
