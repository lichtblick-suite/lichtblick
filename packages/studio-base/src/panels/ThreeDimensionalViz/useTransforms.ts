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

import Transforms from "@foxglove/studio-base/panels/ThreeDimensionalViz/Transforms";
import {
  TF_DATATYPES,
  TRANSFORM_STAMPED_DATATYPES,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import { Frame, MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import { MarkerArray, StampedMessage, TF } from "@foxglove/studio-base/types/Messages";

type TfMessage = { transforms: TF[] };

function consumeTfs(tfs: MessageEvent<TfMessage>[], transforms: Transforms): void {
  for (const { message } of tfs) {
    const parsedMessage = message;
    for (const tf of parsedMessage.transforms) {
      transforms.consume(tf);
    }
  }
}

function consumeSingleTfs(tfs: MessageEvent<TF>[], transforms: Transforms): void {
  for (const { message } of tfs) {
    transforms.consume(message);
  }
}

/**
 * useTransforms accumulates transforms from frames and returns a Transforms instance
 *
 * If there are new transforms from the frame, a new Transforms instance is returned. The new instance
 * contains all accumulated transforms.
 *
 * If the frame is undefined, transform accumulation is reset and all existing transforms are discarded.
 */
// eslint-disable-next-line @foxglove/no-boolean-parameters
function useTransforms(topics: readonly Topic[], frame: Frame, reset: boolean): Transforms {
  const topicsToDatatypes = useMemo(() => {
    return new Map<string, string>(topics.map((topic) => [topic.name, topic.datatype]));
  }, [topics]);

  const transformsRef = useRef(new Transforms());

  return useMemo<Transforms>(() => {
    if (reset) {
      transformsRef.current = new Transforms();
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
          const frameId = (msg.message as StampedMessage).header.frame_id;
          if (frameId != undefined) {
            transforms.register(frameId);
            updated = true;
            continue;
          }
        }
        // A hack specific to MarkerArray messages, which don't themselves have headers, but individual markers do.
        if ("markers" in (msg.message as Partial<MarkerArray>)) {
          const markers = (msg.message as MarkerArray).markers;
          for (const marker of markers) {
            const frameId = marker.header.frame_id;
            if (frameId != undefined) {
              transforms.register(frameId);
              updated = true;
            }
          }
        }
      }

      // Process all TF topics (ex: /tf and /tf_static)
      if (TF_DATATYPES.includes(datatype)) {
        consumeTfs(msgs as MessageEvent<TfMessage>[], transforms);
        updated = true;
      } else if (TRANSFORM_STAMPED_DATATYPES.includes(datatype)) {
        consumeSingleTfs(msgs as MessageEvent<TF>[], transforms);
        updated = true;
      }
    }
    if (!updated) {
      return transforms;
    }

    // clone the transforms object if there were updates
    // This creates a new reference identity for the returned transforms so memoization can update
    const newTransforms = new Transforms();
    newTransforms.storage = transforms.storage;
    newTransforms.empty = transforms.empty;

    return (transformsRef.current = newTransforms);
  }, [reset, frame, topicsToDatatypes]);
}

export default useTransforms;
