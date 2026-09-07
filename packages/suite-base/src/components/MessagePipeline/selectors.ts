// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { Topic } from "@lichtblick/suite-base/players/types";

// Cache the derived map keyed on the `sortedTopics` array reference. The pipeline store only
// rebuilds `sortedTopics` (new reference) when the player's topics change, so the same map can be
// reused across pipeline updates. This keeps frequent callers (e.g. getTopicSchema during
// interactions) from rebuilding the map on every call.
const topicToSchemaNameMapCache = new WeakMap<
  readonly Topic[],
  Record<string, string | undefined>
>();

export const getTopicToSchemaNameMap = (
  state: MessagePipelineContext,
): Record<string, string | undefined> => {
  const { sortedTopics } = state;

  const cached = topicToSchemaNameMapCache.get(sortedTopics);
  if (cached) {
    return cached;
  }

  const result: Record<string, string | undefined> = {};

  for (const topic of sortedTopics) {
    result[topic.name] = topic.schemaName;
  }

  topicToSchemaNameMapCache.set(sortedTopics, result);
  return result;
};
