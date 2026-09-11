// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";

function selectSortedTopics(ctx: MessagePipelineContext) {
  return ctx.sortedTopics;
}

/**
 * Build a {@link DraggedMessagePath} from a series' configured message path string (e.g. a Plot or
 * StateTransitions `path.value`). This allows a series to be used as a message-path drag source so
 * it can be dropped onto another timeseries panel.
 *
 * Returns `undefined` when the value is empty or cannot be parsed, in which case the series should
 * not be draggable.
 */
export function useDraggedMessagePath(value: string | undefined): DraggedMessagePath | undefined {
  const topics = useMessagePipeline(selectSortedTopics);

  return useMemo(() => {
    if (value == undefined || value.length === 0) {
      return undefined;
    }
    const parsed = parseMessagePath(value);
    if (!parsed) {
      return undefined;
    }
    const topic = topics.find((t) => t.name === parsed.topicName);
    return {
      path: value,
      rootSchemaName: topic?.schemaName,
      isTopic: false,
      isLeaf: true,
      topicName: parsed.topicName,
    };
  }, [topics, value]);
}
