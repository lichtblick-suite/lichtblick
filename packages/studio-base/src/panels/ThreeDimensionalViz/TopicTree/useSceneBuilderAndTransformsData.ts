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

import { mapKeys, difference } from "lodash";
import { useMemo, useRef } from "react";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import useChangeDetector from "@foxglove/studio-base/hooks/useChangeDetector";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import { TRANSFORM_TOPIC } from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";

import {
  UseSceneBuilderAndTransformsDataInput,
  UseSceneBuilderAndTransformsDataOutput,
} from "./types";
import { generateNodeKey } from "./useTopicTree";

// Derived namespace and error information for TopicTree from sceneBuilder and transforms.
export default function useSceneBuilderAndTransformsData({
  sceneBuilder,
  transforms,
  staticallyAvailableNamespacesByTopic,
}: UseSceneBuilderAndTransformsDataInput): UseSceneBuilderAndTransformsDataOutput {
  const { playerId } = useDataSourceInfo();
  const hasChangedPlayerId = useChangeDetector([playerId], { initiallyTrue: false });

  const newAvailableTfs = transforms
    .values()
    .map(({ id }) => id)
    .filter(Boolean);
  const availableTfsRef = useRef<string[]>(newAvailableTfs);
  if (hasChangedPlayerId) {
    // If we have changed the playerId - meaning that we've added or removed a source - recalculate the available TFs
    // from scratch.
    availableTfsRef.current = newAvailableTfs;
  } else {
    const tfsNotYetAdded = difference(newAvailableTfs, availableTfsRef.current);
    // Only add TFs, never remove them. If we've seen them once in the bag, they may re-appear.
    // NOTE: changing this to instead show the exact TFs available at this point in time is NOT advisable. There is a
    // subtle bug that will lead to the topic tree "jumping" in position as TFs are quickly removed and then re-added
    // whenever a topic is added.
    if (tfsNotYetAdded.length > 0) {
      availableTfsRef.current = [...availableTfsRef.current, ...tfsNotYetAdded];
    }
  }
  const availableTfs = availableTfsRef.current;

  const availableNamespacesByTopic = useMemo(() => {
    const result = { ...staticallyAvailableNamespacesByTopic };
    for (const { name, topic } of sceneBuilder.allNamespaces) {
      (result[topic] ??= []).push(name);
    }
    if (availableTfs.length > 0) {
      result[TRANSFORM_TOPIC] = availableTfs;
    }
    return result;
  }, [availableTfs, sceneBuilder.allNamespaces, staticallyAvailableNamespacesByTopic]);

  const sceneErrorsByKey = useMemo(
    () =>
      mapKeys(sceneBuilder.errorsByTopic, (_value, topicName) => generateNodeKey({ topicName })),
    [sceneBuilder.errorsByTopic],
  );

  const sceneErrorsByKeyMemo = useDeepMemo(sceneErrorsByKey);

  return { availableNamespacesByTopic, sceneErrorsByKey: sceneErrorsByKeyMemo };
}
