// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useMemo } from "react";

import { Time, Topic } from "@foxglove/studio";
import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove/studio-base/components/MessagePipeline";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

function selectDatatypes(ctx: MessagePipelineContext) {
  return ctx.datatypes;
}

function selectTopics(ctx: MessagePipelineContext) {
  return ctx.sortedTopics;
}

function selectStartTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.startTime;
}

function selectCapabilities(ctx: MessagePipelineContext) {
  return ctx.playerState.capabilities;
}

function selectPlayerId(ctx: MessagePipelineContext) {
  return ctx.playerState.playerId;
}

// Metadata about the source of data currently being displayed.
// This is not expected to change often, usually when changing data sources.
export type DataSourceInfo = {
  topics: readonly Topic[];
  datatypes: RosDatatypes;
  capabilities: string[];
  startTime?: Time; // Only `startTime`, since `endTime` can change rapidly when connected to a live system.
  playerId: string;
};

/**
 * Data source info" encapsulates **rarely-changing** metadata about the source from which
 * Foxglove Studio is loading data.
 *
 * A data source might be a local file, a remote file, or a streaming source.
 */
export function useDataSourceInfo(): DataSourceInfo {
  const datatypes = useMessagePipeline(selectDatatypes);
  const topics = useMessagePipeline(selectTopics);
  const startTime = useMessagePipeline(selectStartTime);
  const capabilities = useMessagePipeline(selectCapabilities);
  const playerId = useMessagePipeline(selectPlayerId);

  // we want the returned object to have a stable identity
  return useMemo<DataSourceInfo>(() => {
    return {
      topics,
      datatypes,
      capabilities,
      startTime,
      playerId,
    };
  }, [capabilities, datatypes, playerId, startTime, topics]);
}
