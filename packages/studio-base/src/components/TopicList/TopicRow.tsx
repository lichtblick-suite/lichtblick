// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReOrderDotsVertical16Regular } from "@fluentui/react-icons";
import { Badge, Typography } from "@mui/material";
import { FzfResultItem } from "fzf";
import { useCallback, useMemo } from "react";

import { HighlightChars } from "@foxglove/studio-base/components/HighlightChars";
import { DraggedMessagePath } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import Stack from "@foxglove/studio-base/components/Stack";
import { Topic } from "@foxglove/studio-base/players/types";
import { useMessagePathDrag } from "@foxglove/studio-base/services/messagePathDragging";

import { TopicStatsChip } from "./TopicStatsChip";
import { useTopicListStyles } from "./useTopicListStyles";

export function TopicRow({
  topicResult,
  style,
  selected,
  onClick,
  onContextMenu,
}: {
  topicResult: FzfResultItem<Topic>;
  style: React.CSSProperties;
  selected: boolean;
  onClick: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu: React.MouseEventHandler<HTMLDivElement>;
}): JSX.Element {
  const { cx, classes } = useTopicListStyles();

  const topic = topicResult.item;

  const item: DraggedMessagePath = useMemo(
    () => ({
      path: topic.name,
      rootSchemaName: topic.schemaName,
      isTopic: true,
      isLeaf: false,
    }),
    [topic.name, topic.schemaName],
  );
  const { connectDragSource, connectDragPreview, cursor, isDragging, draggedItemCount } =
    useMessagePathDrag({
      item,
      selected,
    });

  const combinedRef: React.Ref<HTMLDivElement> = useCallback(
    (el) => {
      connectDragSource(el);
      connectDragPreview(el);
    },
    [connectDragPreview, connectDragSource],
  );

  return (
    <div
      ref={combinedRef}
      className={cx(classes.row, {
        [classes.isDragging]: isDragging,
        [classes.selected]: selected,
      })}
      style={{ ...style, cursor }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {draggedItemCount > 1 && (
        <Badge color="primary" className={classes.countBadge} badgeContent={draggedItemCount} />
      )}
      {/* Extra Stack wrapper to enable growing without the  */}
      <Stack flex="auto" alignItems="flex-start" overflow="hidden">
        <Typography variant="body2" noWrap className={classes.textContent}>
          <HighlightChars str={topic.name} indices={topicResult.positions} />
          {topic.aliasedFromName != undefined && (
            <Typography variant="caption" className={classes.aliasedTopicName}>
              from {topic.aliasedFromName}
            </Typography>
          )}
        </Typography>
        {topic.schemaName != undefined && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            className={classes.textContent}
          >
            <HighlightChars
              str={topic.schemaName}
              indices={topicResult.positions}
              offset={topic.name.length + 1}
            />
          </Typography>
        )}
      </Stack>
      <TopicStatsChip selected={selected} topicName={topic.name} />
      <div data-testid="TopicListDragHandle" className={classes.dragHandle}>
        <ReOrderDotsVertical16Regular />
      </div>
    </div>
  );
}
