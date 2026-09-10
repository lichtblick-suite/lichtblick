// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromNanoSec } from "@lichtblick/rostime";

import { IRenderer } from "./IRenderer";
import { collectEditedTransforms, hasEditedTransforms } from "./publishTransforms";
import { makePose } from "./transforms/geometry";

// ---------------------------------------------------------------------------
// Minimal IRenderer stub — only the fields the tested functions touch.
// ---------------------------------------------------------------------------

type FrameStub = {
  parent: () => { id: string } | undefined;
};

function makeRenderer(overrides: {
  currentTime?: bigint;
  transforms?: Record<string, unknown>;
  frames?: Record<string, FrameStub | undefined>;
  applyResult?: ReturnType<typeof makePose> | undefined;
}): IRenderer {
  const currentTime = overrides.currentTime ?? 1_000_000_000n;
  const transforms = overrides.transforms ?? {};
  const frames = overrides.frames ?? {};
  const applyResult = overrides.applyResult;

  return {
    currentTime,
    config: { transforms } as IRenderer["config"],
    transformTree: {
      frame: (id: string) => frames[id],
      apply: jest.fn(
        (
          output: ReturnType<typeof makePose>,
          _input: ReturnType<typeof makePose>,
          _frameId: string,
          _rootFrameId: string,
          _srcFrameId: string,
          _dstTime: bigint,
          _srcTime: bigint,
        ) => {
          if (applyResult == undefined) {
            return undefined;
          }
          output.position.x = applyResult.position.x;
          output.position.y = applyResult.position.y;
          output.position.z = applyResult.position.z;
          output.orientation.x = applyResult.orientation.x;
          output.orientation.y = applyResult.orientation.y;
          output.orientation.z = applyResult.orientation.z;
          output.orientation.w = applyResult.orientation.w;
          return output;
        },
      ),
    },
  } as unknown as IRenderer;
}

// ---------------------------------------------------------------------------

describe("collectEditedTransforms", () => {
  describe("frame filtering", () => {
    it("returns an empty array when no transform keys exist", () => {
      // Given: a renderer with no configured transforms
      const renderer = makeRenderer({ transforms: {} });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: the result is empty
      expect(result).toEqual([]);
    });

    it("ignores keys that do not start with 'frame:'", () => {
      // Given: a renderer whose config keys are not frame keys
      const renderer = makeRenderer({
        transforms: {
          scene: { xyzOffset: [1, 0, 0] },
          "topic:/scan": { xyzOffset: [0, 1, 0] },
        },
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: non-frame keys are ignored
      expect(result).toEqual([]);
    });

    it("ignores frame entries whose offsets are all zero", () => {
      // Given: a frame key with all-zero offsets
      const renderer = makeRenderer({
        transforms: { "frame:sensor": { xyzOffset: [0, 0, 0], rpyCoefficient: [0, 0, 0] } },
        frames: { sensor: { parent: () => ({ id: "base" }) } },
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: zero-offset frames are not included
      expect(result).toEqual([]);
    });

    it("ignores frame entries whose offsets are undefined", () => {
      // Given: a frame key with all-undefined offsets
      const renderer = makeRenderer({
        transforms: {
          "frame:sensor": {
            xyzOffset: [undefined, undefined, undefined],
            rpyCoefficient: [undefined, undefined, undefined],
          },
        },
        frames: { sensor: { parent: () => ({ id: "base" }) } },
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: undefined-offset frames are not included
      expect(result).toEqual([]);
    });

    it("ignores frame entries with no settings at all", () => {
      // Given: a frame key whose settings value is undefined
      const renderer = makeRenderer({
        transforms: { "frame:sensor": undefined },
        frames: { sensor: { parent: () => ({ id: "base" }) } },
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: the frame is skipped
      expect(result).toEqual([]);
    });
  });

  describe("resolvability guards", () => {
    it("skips a frame that is not found in the transform tree", () => {
      // Given: an edited frame key with no corresponding frame in the tree
      const renderer = makeRenderer({
        transforms: { "frame:ghost": { xyzOffset: [1, 0, 0] } },
        frames: {},
        applyResult: makePose(),
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: the unresolvable frame is skipped
      expect(result).toEqual([]);
    });

    it("skips a frame whose parent is not known", () => {
      // Given: an edited frame with no parent in the tree
      const renderer = makeRenderer({
        transforms: { "frame:orphan": { xyzOffset: [1, 0, 0] } },
        frames: { orphan: { parent: () => undefined } },
        applyResult: makePose(),
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: the parentless frame is skipped
      expect(result).toEqual([]);
    });

    it("skips a frame whose transform cannot be resolved", () => {
      // Given: an edited frame for which apply() returns undefined
      const renderer = makeRenderer({
        transforms: { "frame:sensor": { xyzOffset: [1, 0, 0] } },
        frames: { sensor: { parent: () => ({ id: "base" }) } },
        applyResult: undefined,
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: frames with unresolvable transforms are skipped
      expect(result).toEqual([]);
    });
  });

  describe("message construction", () => {
    it("emits a message for a frame with a non-zero xyzOffset", () => {
      // Given: a renderer with one edited frame whose pose resolves to known values
      const resolvedPose = makePose();
      resolvedPose.position.x = 1;
      resolvedPose.position.y = 2;
      resolvedPose.position.z = 3;
      const renderer = makeRenderer({
        currentTime: 2_000_000_000n,
        transforms: { "frame:sensor": { xyzOffset: [1, 0, 0] } },
        frames: { sensor: { parent: () => ({ id: "base" }) } },
        applyResult: resolvedPose,
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: one message is emitted with the correct fields
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        timestamp: fromNanoSec(2_000_000_000n),
        parent_frame_id: "base",
        child_frame_id: "sensor",
        translation: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      });
    });

    it("emits a message for a frame with a non-zero rpyCoefficient", () => {
      // Given: a renderer with one frame whose rotation offset resolves to a quaternion
      const resolvedPose = makePose();
      resolvedPose.orientation.z = 0.707;
      resolvedPose.orientation.w = 0.707;
      const renderer = makeRenderer({
        transforms: { "frame:lidar": { rpyCoefficient: [0, 0, 90] } },
        frames: { lidar: { parent: () => ({ id: "vehicle" }) } },
        applyResult: resolvedPose,
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: the rotation is taken from the resolved pose
      expect(result).toHaveLength(1);
      expect(result[0]!.rotation).toMatchObject({
        x: 0,
        y: 0,
        z: expect.closeTo(0.707, 2),
        w: expect.closeTo(0.707, 2),
      });
    });

    it("includes frames with mixed zero/non-zero offset components", () => {
      // Given: a frame with only the y component non-zero
      const renderer = makeRenderer({
        transforms: { "frame:cam": { xyzOffset: [0, 0.5, 0] } },
        frames: { cam: { parent: () => ({ id: "base" }) } },
        applyResult: makePose(),
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: the frame is included because at least one component is non-zero
      expect(result).toHaveLength(1);
    });

    it("emits one message per edited frame", () => {
      // Given: a renderer with two independently edited frames
      const renderer = makeRenderer({
        transforms: {
          "frame:left": { xyzOffset: [1, 0, 0] },
          "frame:right": { xyzOffset: [0, 1, 0] },
        },
        frames: {
          left: { parent: () => ({ id: "base" }) },
          right: { parent: () => ({ id: "base" }) },
        },
        applyResult: makePose(),
      });

      // When: collecting edited transforms
      const result = collectEditedTransforms(renderer);

      // Then: one message is produced per edited frame
      expect(result).toHaveLength(2);
      const ids = result.map((m) => m.child_frame_id).sort();
      expect(ids).toEqual(["left", "right"]);
    });

    it("uses renderer.currentTime as the message timestamp", () => {
      // Given: a renderer with a specific current time
      const nanos = 5_123_456_789n;
      const renderer = makeRenderer({
        currentTime: nanos,
        transforms: { "frame:sensor": { xyzOffset: [1, 0, 0] } },
        frames: { sensor: { parent: () => ({ id: "base" }) } },
        applyResult: makePose(),
      });

      // When: collecting edited transforms
      const [msg] = collectEditedTransforms(renderer);

      // Then: the timestamp matches the renderer's current time, and apply was called with the
      // correct parent frame, child frame, and time arguments
      expect(msg!.timestamp).toEqual(fromNanoSec(nanos));
      const apply = renderer.transformTree.apply as jest.Mock;
      expect(apply).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "base",
        "base",
        "sensor",
        nanos,
        nanos,
      );
    });
  });
});

describe("hasEditedTransforms", () => {
  it("returns false when there are no transform keys", () => {
    // Given: a renderer with no configured transforms
    const renderer = makeRenderer({ transforms: {} });

    // When: checking for edited transforms
    // Then: false is returned
    expect(hasEditedTransforms(renderer)).toBe(false);
  });

  it("returns false when keys do not start with 'frame:'", () => {
    // Given: a renderer whose only config key is not a frame key
    const renderer = makeRenderer({ transforms: { scene: { xyzOffset: [1, 0, 0] } } });

    // When/Then
    expect(hasEditedTransforms(renderer)).toBe(false);
  });

  it("returns false when all frame offsets are zero", () => {
    // Given: a frame key with all-zero offsets
    const renderer = makeRenderer({
      transforms: { "frame:sensor": { xyzOffset: [0, 0, 0], rpyCoefficient: [0, 0, 0] } },
    });

    // When/Then
    expect(hasEditedTransforms(renderer)).toBe(false);
  });

  it("returns false when all frame offsets are undefined", () => {
    // Given: a frame key with all-undefined offsets
    const renderer = makeRenderer({
      transforms: {
        "frame:sensor": {
          xyzOffset: [undefined, undefined, undefined],
          rpyCoefficient: [undefined, undefined, undefined],
        },
      },
    });

    // When/Then
    expect(hasEditedTransforms(renderer)).toBe(false);
  });

  it("returns true when a frame has a non-zero xyzOffset", () => {
    // Given: a frame key with a non-zero xyzOffset
    const renderer = makeRenderer({
      transforms: { "frame:sensor": { xyzOffset: [1, 0, 0] } },
    });

    // When/Then
    expect(hasEditedTransforms(renderer)).toBe(true);
  });

  it("returns true when a frame has a non-zero rpyCoefficient", () => {
    // Given: a frame key with a non-zero rpyCoefficient
    const renderer = makeRenderer({
      transforms: { "frame:lidar": { rpyCoefficient: [0, 0, 90] } },
    });

    // When/Then
    expect(hasEditedTransforms(renderer)).toBe(true);
  });

  it("returns true when only one of multiple frames is edited", () => {
    // Given: two frames where only one has a non-zero offset
    const renderer = makeRenderer({
      transforms: {
        "frame:left": { xyzOffset: [0, 0, 0] },
        "frame:right": { xyzOffset: [0, 1, 0] },
      },
    });

    // When/Then
    expect(hasEditedTransforms(renderer)).toBe(true);
  });

  it("returns false after offsets are reset to zero (edited-to-empty transition)", () => {
    // Given: a renderer config with an edited frame
    const transforms: Record<string, unknown> = {
      "frame:sensor": { xyzOffset: [1, 0, 0] },
    };
    const renderer = makeRenderer({ transforms });
    expect(hasEditedTransforms(renderer)).toBe(true);

    // When: the offset is cleared back to zero (simulating a user reset)
    transforms["frame:sensor"] = { xyzOffset: [0, 0, 0] };

    // Then: hasEditedTransforms reflects the updated config immediately
    expect(hasEditedTransforms(renderer)).toBe(false);
  });
});
