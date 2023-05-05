// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

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
  TypographyProps,
} from "@mui/material";
import { Fzf, FzfResultItem } from "fzf";
import { useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { DirectTopicStatsUpdater } from "@foxglove/studio-base/components/DirectTopicStatsUpdater";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import { PlayerPresence, TopicStats } from "@foxglove/studio-base/players/types";
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

const HighlightChars = ({
  str,
  indices,
  color,
  offset = 0,
}: {
  str: string;
  indices: Set<number>;
  color?: TypographyProps["color"];
  offset?: number;
}) => {
  const chars = str.split("");

  const nodes = chars.map((char, i) => {
    if (indices.has(i + offset)) {
      return (
        <Typography component="b" key={i} variant="inherit" color={color ?? "info.main"}>
          {char}
        </Typography>
      );
    }
    return char;
  });

  return <>{nodes}</>;
};

const useStyles = makeStyles()((theme) => ({
  appBar: {
    top: 0,
    zIndex: theme.zIndex.appBar,
    padding: theme.spacing(0.5),
    position: "sticky",
    backgroundColor: theme.palette.background.paper,
  },
  listItem: {
    paddingRight: theme.spacing(1),

    "&.MuiListItem-dense": {
      ".MuiListItemText-root": {
        marginTop: theme.spacing(0.5),
        marginBottom: theme.spacing(0.5),
      },
    },
    ".MuiListItemSecondaryAction-root": {
      marginRight: theme.spacing(-1),
    },
  },
  textField: {
    ".MuiOutlinedInput-notchedOutline": {
      border: "none",
    },
  },
  startAdornment: {
    display: "flex",
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
  const { classes } = useStyles();
  return (
    <ListItem
      className={classes.listItem}
      divider
      key={topic.name}
      secondaryAction={
        <Stack style={{ textAlign: "right" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            data-topic={topic.name}
            data-topic-stat="count"
          >
            &mdash;
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            data-topic={topic.name}
            data-topic-stat="frequency"
          >
            &mdash;
          </Typography>
        </Stack>
      }
    >
      <ListItemText
        primary={<HighlightChars str={topic.name} indices={positions} />}
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
        style={{ marginRight: "48px" }}
      />
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
            className={classes.textField}
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
          className={classes.textField}
          fullWidth
          placeholder="Filter by topic or datatype…"
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
                title="Clear search"
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
          {filteredTopics.map(({ item: topic, positions }) => {
            return <MemoTopicListItem key={topic.name} topic={topic} positions={positions} />;
          })}
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
