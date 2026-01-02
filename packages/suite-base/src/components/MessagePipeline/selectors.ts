// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";

export const getTopicToSchemaNameMap = (
  state: MessagePipelineContext,
): Record<string, string | undefined> => {
  const result: Record<string, string | undefined> = {};

  for (const topic of state.sortedTopics) {
    result[topic.name] = topic.schemaName;
  }
  return result;
};
