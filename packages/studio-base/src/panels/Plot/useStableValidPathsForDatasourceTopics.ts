// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";
import { createSelector } from "reselect";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import { Immutable } from "@foxglove/studio";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { PlotPath } from "@foxglove/studio-base/panels/Plot/internalTypes";

const selectKeyedTopics = createSelector(
  (ctx: MessagePipelineContext) => {
    return ctx.sortedTopics;
  },
  (topics) => new Set(topics.map((topic) => topic.name)),
);

/**
 * Returns a referentially stable list of paths that parse as a valid path and reference a topic
 * that exists in our datasource.
 */
export function useStableValidPathsForDatasourceTopics(
  paths: Immutable<PlotPath[]>,
): Immutable<PlotPath[]> {
  const keyedTopics = useMessagePipeline(selectKeyedTopics);

  const validPaths = useMemo(
    () =>
      filterMap(paths, (path) => {
        const parsedTopic = parseRosPath(path.value)?.topicName;
        const pathIsBareTopic = path.value === parsedTopic;
        return !pathIsBareTopic && parsedTopic && keyedTopics.has(parsedTopic) ? path : undefined;
      }),
    [keyedTopics, paths],
  );

  const stableValidPaths = useShallowMemo(validPaths);

  return stableValidPaths;
}
