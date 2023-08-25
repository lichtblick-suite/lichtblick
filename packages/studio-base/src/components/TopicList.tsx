// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReOrderDotsVertical16Regular } from "@fluentui/react-icons";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import {
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  TextField,
  Typography,
} from "@mui/material";
import { Fzf, FzfResultItem } from "fzf";
import { useMemo, useState } from "react";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { DirectTopicStatsUpdater } from "@foxglove/studio-base/components/DirectTopicStatsUpdater";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { HighlightChars } from "@foxglove/studio-base/components/HighlightChars";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import { TopicStatsChip } from "@foxglove/studio-base/components/TopicStatsChip";
import { PlayerPresence, TopicStats } from "@foxglove/studio-base/players/types";
import { useMessagePathDrag } from "@foxglove/studio-base/services/messagePathDragging";
import { Topic } from "@foxglove/studio-base/src/players/types";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

type TopicWithStats = Topic & Partial<TopicStats>;

const topicToFzfResult = (item: TopicWithStats) =>
  ({
    item,
    score: 0,
    positions: new Set<number>(),
    start: 0,
    end: 0,
  } as FzfResultItem<TopicWithStats>);

const useStyles = makeStyles<void, "dragHandle">()((theme, _params, classes) => ({
  appBar: {
    top: 0,
    zIndex: theme.zIndex.appBar,
    padding: theme.spacing(0.5),
    position: "sticky",
    backgroundColor: theme.palette.background.paper,
  },
  listItem: {
    backgroundColor: theme.palette.background.paper,
    containerType: "inline-size",
    paddingRight: 0,

    "&.isDragging:active": {
      backgroundColor: tc(theme.palette.primary.main)
        .setAlpha(theme.palette.action.hoverOpacity)
        .toRgbString(),
      outline: `1px solid ${theme.palette.primary.main}`,
      outlineOffset: -1,
      borderRadius: theme.shape.borderRadius,
    },
    [`:not(:hover) .${classes.dragHandle}`]: {
      visibility: "hidden",
    },
  },
  listItemText: {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  aliasedTopicName: {
    color: theme.palette.primary.main,
    display: "block",
    textAlign: "start",
  },
  startAdornment: {
    display: "flex",
  },
  dragHandle: {
    opacity: 0.6,
    cursor: "grab",
  },
}));

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectSortedTopics = ({ sortedTopics }: MessagePipelineContext) => sortedTopics;

function TopicListItem({
  topic,
  positions,
}: {
  topic: Topic;
  positions: Set<number>;
}): JSX.Element {
  const { classes, cx } = useStyles();
  const { connectDragSource, connectDragPreview, cursor, isDragging } = useMessagePathDrag({
    path: topic.name,
    rootSchemaName: topic.schemaName,
  });

  return (
    <ListItem
      key={topic.name}
      divider
      className={cx(classes.listItem, { isDragging })}
      ref={connectDragPreview}
    >
      <ListItemText
        className={classes.listItemText}
        primary={
          <>
            <HighlightChars str={topic.name} indices={positions} />
            {topic.aliasedFromName && (
              <Typography variant="caption" className={classes.aliasedTopicName}>
                from {topic.aliasedFromName}
              </Typography>
            )}
          </>
        }
        primaryTypographyProps={{ noWrap: true, title: topic.name }}
        secondary={
          topic.schemaName == undefined ? (
            "—"
          ) : (
            <HighlightChars
              str={topic.schemaName}
              indices={positions}
              offset={topic.name.length + 1}
            />
          )
        }
        secondaryTypographyProps={{
          variant: "caption",
          fontFamily: fonts.MONOSPACE,
          noWrap: true,
          title: topic.schemaName,
        }}
      />
      <Stack direction="row" alignItems="center" fullHeight gap={0.5} paddingX={0.5}>
        <TopicStatsChip topicName={topic.name} />
        <div
          className={classes.dragHandle}
          data-testid="TopicListDragHandle"
          ref={connectDragSource}
          style={{ cursor }}
        >
          <ReOrderDotsVertical16Regular />
        </div>
      </Stack>
    </ListItem>
  );
}

const MemoTopicListItem = React.memo(TopicListItem);

export function TopicList(): JSX.Element {
  const { classes, cx } = useStyles();
  const [filterText, setFilterText] = useState<string>("");

  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const topics = useMessagePipeline(selectSortedTopics);

  const filteredTopics: FzfResultItem<Topic>[] = useMemo(
    () =>
      filterText
        ? new Fzf(topics, {
            fuzzy: filterText.length > 2 ? "v2" : false,
            sort: true,
            selector: (item) => `${item.name}|${item.schemaName}`,
          }).find(filterText)
        : topics.map((item) => topicToFzfResult(item)),
    [filterText, topics],
  );

  if (playerPresence === PlayerPresence.NOT_PRESENT) {
    return <EmptyState>No data source selected</EmptyState>;
  }

  if (playerPresence === PlayerPresence.ERROR) {
    return <EmptyState>An error occurred</EmptyState>;
  }

  if (playerPresence === PlayerPresence.INITIALIZING) {
    return (
      <>
        <header className={classes.appBar}>
          <TextField
            disabled
            variant="filled"
            fullWidth
            placeholder="Waiting for data..."
            InputProps={{
              size: "small",
              startAdornment: <SearchIcon fontSize="small" />,
            }}
          />
        </header>
        <List key="loading" dense disablePadding>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
            <ListItem className={cx(classes.listItem, "loading")} divider key={i}>
              <ListItemText
                className={classes.listItemText}
                primary={<Skeleton animation={false} width="20%" />}
                secondary={<Skeleton animation="wave" width="55%" />}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </ListItem>
          ))}
        </List>
      </>
    );
  }

  return (
    <>
      <header className={classes.appBar}>
        <TextField
          id="topic-filter"
          variant="filled"
          disabled={playerPresence !== PlayerPresence.PRESENT}
          onChange={(event) => setFilterText(event.target.value)}
          value={filterText}
          fullWidth
          placeholder="Filter by topic or schema name…"
          InputProps={{
            size: "small",
            startAdornment: (
              <label className={classes.startAdornment} htmlFor="topic-filter">
                <SearchIcon fontSize="small" />
              </label>
            ),
            endAdornment: filterText && (
              <IconButton
                size="small"
                title="Clear filter"
                onClick={() => setFilterText("")}
                edge="end"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
      </header>

      {filteredTopics.length > 0 ? (
        <List key="topics" dense disablePadding>
          {filteredTopics.map(({ item: topic, positions }) => (
            <MemoTopicListItem key={topic.name} topic={topic} positions={positions} />
          ))}
        </List>
      ) : (
        <EmptyState>
          {playerPresence === PlayerPresence.PRESENT && filterText
            ? `No topics or datatypes matching \n “${filterText}”`
            : "No topics available. "}
          {playerPresence === PlayerPresence.RECONNECTING && "Waiting for connection"}
        </EmptyState>
      )}
      <DirectTopicStatsUpdater interval={6} />
    </>
  );
}
