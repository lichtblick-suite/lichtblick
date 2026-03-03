// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ChevronLeft16Regular,
  ChevronRight16Regular,
  ReOrderDotsVertical16Regular,
} from "@fluentui/react-icons";
import { Badge, IconButton, Tooltip, Typography } from "@mui/material";
import { FzfResultItem } from "fzf";
import { useCallback, useMemo } from "react";

import { quoteTopicNameIfNeeded } from "@lichtblick/message-path";
import { HighlightChars } from "@lichtblick/suite-base/components/HighlightChars";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import Stack from "@lichtblick/suite-base/components/Stack";
import { Topic } from "@lichtblick/suite-base/players/types";
import { useMessagePathDrag } from "@lichtblick/suite-base/services/messagePathDragging";

import { TopicStatsChip } from "./TopicStatsChip";
import { useTopicListStyles } from "./useTopicListStyles";
import { useTopicMessageNavigation } from "./useTopicMessageNavigation";

const selectSubscriptions = (ctx: MessagePipelineContext) => ctx.subscriptions;

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
}): React.JSX.Element {
  const { cx, classes } = useTopicListStyles();

  const topic = topicResult.item;

  const subscriptions = useMessagePipeline(selectSubscriptions);

  const isTopicSubscribed = useMemo(
    () => subscriptions.some((sub) => sub.topic === topic.name),
    [subscriptions, topic.name],
  );

  const {
    handleNextMessage,
    handlePreviousMessage,
    isNavigating,
    canNavigateNext,
    canNavigatePrevious,
  } = useTopicMessageNavigation({
    topicName: topic.name,
    isTopicSubscribed,
    selected,
  });

  const isNavigationDisabled = useMemo(
    () => isNavigating || !selected || !isTopicSubscribed,
    [isNavigating, selected, isTopicSubscribed],
  );

  const isPreviousDisabled = useMemo(
    () => isNavigationDisabled || !canNavigatePrevious,
    [isNavigationDisabled, canNavigatePrevious],
  );
  const isNextDisabled = useMemo(
    () => isNavigationDisabled || !canNavigateNext,
    [isNavigationDisabled, canNavigateNext],
  );

  const item: DraggedMessagePath = useMemo(
    () => ({
      path: quoteTopicNameIfNeeded(topic.name),
      rootSchemaName: topic.schemaName,
      isTopic: true,
      isLeaf: false,
      topicName: topic.name,
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

  const seekToNextMessage = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      void handleNextMessage();
    },
    [handleNextMessage],
  );

  const seekToPreviousMessage = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      void handlePreviousMessage();
    },
    [handlePreviousMessage],
  );

  const handleButtonMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

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
      <Stack direction="column" alignItems="flex-end" gap={0.5}>
        <TopicStatsChip selected={selected} topicName={topic.name} />
        <Stack direction="row" gap={0.5} alignItems="center">
          <Tooltip title={isPreviousDisabled ? "" : "Previous message"}>
            <span>
              <IconButton
                size="small"
                aria-label="Previous message"
                onClick={seekToPreviousMessage}
                onMouseDown={handleButtonMouseDown}
                disabled={isPreviousDisabled}
                className={classes.navIconButton}
              >
                <ChevronLeft16Regular />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={isNextDisabled ? "" : "Next message"}>
            <span>
              <IconButton
                size="small"
                aria-label="Next message"
                onClick={seekToNextMessage}
                onMouseDown={handleButtonMouseDown}
                disabled={isNextDisabled}
                className={classes.navIconButton}
              >
                <ChevronRight16Regular />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <div data-testid="TopicListDragHandle" className={classes.dragHandle}>
        <ReOrderDotsVertical16Regular />
      </div>
    </div>
  );
}
