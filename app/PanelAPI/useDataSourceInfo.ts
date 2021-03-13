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

import { useCallback } from "react";
import { Time } from "rosbag";

import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove-studio/app/components/MessagePipeline";
import { Topic } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";

// Metadata about the source of data currently being displayed in Webviz.
// This is not expected to change often, usually when changing data sources.
export type DataSourceInfo = {
  topics: readonly Topic[];
  datatypes: RosDatatypes;
  capabilities: string[];
  startTime?: Time; // Only `startTime`, since `endTime` can change rapidly when connected to a live system.
  playerId: string;
};

export default function useDataSourceInfo(): DataSourceInfo {
  const datatypes = useMessagePipeline(
    useCallback(
      ({ datatypes: pipelineDatatypes }: MessagePipelineContext) => pipelineDatatypes,
      [],
    ),
  );
  const topics = useMessagePipeline(
    useCallback(({ sortedTopics }: MessagePipelineContext) => sortedTopics, []),
  );
  const startTime = useMessagePipeline(
    useCallback(
      ({ playerState: { activeData } }: MessagePipelineContext) => activeData?.startTime,
      [],
    ),
  );
  const capabilities = useMessagePipeline(
    useCallback(
      ({ playerState: { capabilities: playerStateCapabilities } }: MessagePipelineContext) =>
        playerStateCapabilities,
      [],
    ),
  );
  const playerId = useMessagePipeline(
    useCallback(
      ({ playerState: { playerId: playerStatePlayerId } }: MessagePipelineContext) =>
        playerStatePlayerId,
      [],
    ),
  );

  return {
    topics,
    datatypes,
    capabilities,
    startTime,
    playerId,
  };
}
