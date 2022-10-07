// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useMemo, useRef } from "react";

import {
  ROS_TF_DATATYPES,
  FOXGLOVE_TF_DATATYPES,
  TRANSFORM_STAMPED_DATATYPES,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import {
  IImmutableTransformTree,
  Transform,
  TransformTree,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import {
  quatFromValues,
  vec3FromValues,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms/geometry";
import { MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";
import { MarkerArray, StampedMessage, TF } from "@foxglove/studio-base/types/Messages";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

import { TransformLink } from "./types";
import { Frame } from "./useFrame";

type TfMessage = { transforms: TF[] };

function consumeTfs(tfs: MessageEvent<TfMessage>[], transforms: TransformTree): void {
  for (const { message } of tfs) {
    const parsedMessage = message;
    for (const tf of parsedMessage.transforms) {
      transforms.addTransformMessage(tf);
    }
  }
}

function consumeSingleTfs(tfs: MessageEvent<TF>[], transforms: TransformTree): void {
  for (const { message } of tfs) {
    transforms.addTransformMessage(message);
  }
}

function consumeFoxgloveFrameTransform(
  msgEvents: MessageEvent<FoxgloveMessages["foxglove.FrameTransform"]>[],
  transformTree: TransformTree,
): void {
  for (const { message } of msgEvents) {
    const translation = message.translation ?? message.transform?.translation;
    const rotation = message.rotation ?? message.transform?.rotation;
    if (!translation || !rotation) {
      continue;
    }
    const transform = new Transform(
      vec3FromValues(translation.x, translation.y, translation.z),
      quatFromValues(rotation.x, rotation.y, rotation.z, rotation.w),
    );

    transformTree.addTransform(
      message.child_frame_id,
      message.parent_frame_id,
      message.timestamp,
      transform,
    );
  }
}

type Args = {
  topics: readonly Topic[];
  frame: Frame;
  reset: boolean;
  urdfTransforms: TransformLink[];
};

/**
 * useTransforms accumulates transforms from frames and returns an IImmutableTransformTree instance.
 *
 * If there are new transforms from the frame, a new IImmutableTransformTree instance is returned.
 * The new instance contains all accumulated transforms.
 *
 * If the reset arg is true, transform accumulation is reset and all existing transforms are
 * discarded.
 *
 * NOTE: Immutability is important. All mutations of the transform tree must go through
 * useTransforms to ensure a new instance of the tree is created when adding transforms. This is
 * required for proper updates of react hook dependencies.
 */
function useTransforms(args: Args): IImmutableTransformTree {
  const { topics, frame, reset, urdfTransforms } = args;

  const topicsToDatatypes = useMemo(() => {
    return new Map<string, string>(topics.map((topic) => [topic.name, topic.schemaName]));
  }, [topics]);

  const transformsRef = useRef(new TransformTree());

  return useMemo<TransformTree>(() => {
    if (reset) {
      transformsRef.current = new TransformTree();
    }

    const transforms = transformsRef.current;

    let updated = false;
    // Find any references to previously unseen frames in the set of incoming messages
    // Note the naming confusion between `frame` (a map of topic names to messages received on
    // that topic) and transform frames (coordinate frames)
    for (const topic in frame) {
      const datatype = topicsToDatatypes.get(topic) ?? "";
      const msgs = frame[topic];
      if (!msgs) {
        continue;
      }

      for (const msg of msgs) {
        if ("header" in (msg.message as Partial<StampedMessage>)) {
          const frameId = (msg.message as Partial<StampedMessage>).header?.frame_id;
          if (frameId != undefined) {
            transforms.getOrCreateFrame(frameId);
            updated = true;
            continue;
          }
        }
        // Handle Foxglove schemas which have frame_id and timestamp at the root instead of nested in header
        if ("frame_id" in (msg.message as { frame_id?: string })) {
          const frameId = (msg.message as { frame_id?: string }).frame_id;
          if (frameId != undefined) {
            transforms.getOrCreateFrame(frameId);
            updated = true;
            continue;
          }
        }
        // A hack specific to MarkerArray messages, which don't themselves have headers, but individual markers do.
        if ("markers" in (msg.message as Partial<MarkerArray>)) {
          const markers = (msg.message as MarkerArray).markers;
          for (const marker of markers) {
            const frameId = mightActuallyBePartial(marker).header?.frame_id;
            if (frameId != undefined) {
              transforms.getOrCreateFrame(frameId);
              updated = true;
            }
          }
        }
      }

      // Process all TF topics (ex: /tf and /tf_static)
      if (ROS_TF_DATATYPES.includes(datatype)) {
        consumeTfs(msgs as MessageEvent<TfMessage>[], transforms);
        updated = true;
      } else if (TRANSFORM_STAMPED_DATATYPES.includes(datatype)) {
        consumeSingleTfs(msgs as MessageEvent<TF>[], transforms);
        updated = true;
      } else if (FOXGLOVE_TF_DATATYPES.includes(datatype)) {
        consumeFoxgloveFrameTransform(
          msgs as MessageEvent<FoxgloveMessages["foxglove.FrameTransform"]>[],
          transforms,
        );
        updated = true;
      }
    }

    for (const link of urdfTransforms) {
      transforms.addTransform(link.child, link.parent, { sec: 0, nsec: 0 }, link.transform);
      updated = true;
    }

    if (!updated) {
      return transforms;
    }

    // clone the transforms object if there were updates
    // This creates a new reference identity for the returned transforms so memoization can update
    const newTransforms = TransformTree.Clone(transforms);
    return (transformsRef.current = newTransforms);
  }, [reset, frame, topicsToDatatypes, urdfTransforms]);
}

export default useTransforms;
