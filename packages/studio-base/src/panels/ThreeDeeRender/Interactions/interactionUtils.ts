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

import { keyBy } from "lodash";

import { LinkedGlobalVariables, LinkedGlobalVariable } from "./useLinkedGlobalVariables";

export function getTopicWithPath({
  topic,
  markerKeyPath,
}: {
  topic: string;
  markerKeyPath: string[];
}): string {
  return `${topic}.${getPath(markerKeyPath)}`;
}

export function getPath(markerKeyPath: string[]): string {
  return [...markerKeyPath].reverse().join(".");
}

export function getLinkedGlobalVariableKeyByTopicWithPath(
  linkedGlobalVariables: LinkedGlobalVariables,
): {
  [key: string]: LinkedGlobalVariable;
} {
  return keyBy(linkedGlobalVariables, ({ topic, markerKeyPath }) =>
    getTopicWithPath({ topic, markerKeyPath }),
  );
}

export function getLinkedGlobalVariable({
  topic,
  markerKeyPath,
  linkedGlobalVariables,
}: {
  topic: string;
  markerKeyPath: string[];
  linkedGlobalVariables: LinkedGlobalVariables;
}): LinkedGlobalVariable | undefined {
  const linkedGlobalVariablesKeyByTopicWithPath =
    getLinkedGlobalVariableKeyByTopicWithPath(linkedGlobalVariables);
  const topicWithPath = getTopicWithPath({ topic, markerKeyPath });
  return linkedGlobalVariablesKeyByTopicWithPath[topicWithPath];
}
