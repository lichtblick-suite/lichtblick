// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReOrderDotsVertical16Regular } from "@fluentui/react-icons";
import { Typography } from "@mui/material";
import { FzfResultItem } from "fzf";

import { HighlightChars } from "@foxglove/studio-base/components/HighlightChars";
import Stack from "@foxglove/studio-base/components/Stack";
import { Topic } from "@foxglove/studio-base/players/types";
import { useMessagePathDrag } from "@foxglove/studio-base/services/messagePathDragging";

import { TopicStatsChip } from "./TopicStatsChip";
import { useTopicListStyles } from "./useTopicListStyles";

export function TopicRow({
  topicResult,
  style,
}: {
  topicResult: FzfResultItem<Topic>;
  style: React.CSSProperties;
}): JSX.Element {
  const { cx, classes } = useTopicListStyles();

  const topic = topicResult.item;

  const { connectDragSource, connectDragPreview, cursor, isDragging } = useMessagePathDrag({
    path: topic.name,
    rootSchemaName: topic.schemaName,
    isTopic: true,
    isLeaf: false,
  });

  return (
    <div
      ref={connectDragPreview}
      className={cx(classes.row, { [classes.isDragging]: isDragging })}
      style={style}
    >
      <Stack flex="auto" overflow="hidden">
        <Typography variant="body2" noWrap>
          <HighlightChars str={topic.name} indices={topicResult.positions} />
          {topic.aliasedFromName != undefined && (
            <Typography variant="caption" className={classes.aliasedTopicName}>
              from {topic.aliasedFromName}
            </Typography>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {topic.schemaName == undefined ? (
            "—"
          ) : (
            <HighlightChars
              str={topic.schemaName}
              indices={topicResult.positions}
              offset={topic.name.length + 1}
            />
          )}
        </Typography>
      </Stack>
      <TopicStatsChip topicName={topic.name} />
      <div
        data-testid="TopicListDragHandle"
        ref={connectDragSource}
        style={{ cursor }}
        className={classes.dragHandle}
      >
        <ReOrderDotsVertical16Regular />
      </div>
    </div>
  );
}
