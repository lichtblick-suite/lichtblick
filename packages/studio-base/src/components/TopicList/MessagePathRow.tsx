// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReOrderDotsVertical16Regular } from "@fluentui/react-icons";
import { Typography } from "@mui/material";
import { FzfResultItem } from "fzf";

import { HighlightChars } from "@foxglove/studio-base/components/HighlightChars";
import Stack from "@foxglove/studio-base/components/Stack";
import { useMessagePathDrag } from "@foxglove/studio-base/services/messagePathDragging";

import { MessagePathSearchItem } from "./getMessagePathSearchItems";
import { useTopicListStyles } from "./useTopicListStyles";

export function MessagePathRow({
  messagePathResult,
  style,
}: {
  messagePathResult: FzfResultItem<MessagePathSearchItem>;
  style: React.CSSProperties;
}): JSX.Element {
  const { cx, classes } = useTopicListStyles();

  const {
    fullPath,
    suffix: { pathSuffix, type, isLeaf },
    topic,
  } = messagePathResult.item;

  const { connectDragSource, cursor, isDragging } = useMessagePathDrag({
    path: fullPath,
    rootSchemaName: topic.schemaName,
    isTopic: false,
    isLeaf,
  });

  return (
    <div
      ref={connectDragSource}
      className={cx(classes.row, classes.fieldRow, { [classes.isDragging]: isDragging })}
      style={{ ...style, cursor }}
    >
      <Stack flex="auto" direction="row" gap={2} overflow="hidden">
        <Typography variant="body2" noWrap>
          <HighlightChars
            str={pathSuffix}
            indices={messagePathResult.positions}
            offset={messagePathResult.item.offset}
          />
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {type}
        </Typography>
      </Stack>
      <div data-testid="TopicListDragHandle" style={{ cursor }} className={classes.dragHandle}>
        <ReOrderDotsVertical16Regular />
      </div>
    </div>
  );
}
