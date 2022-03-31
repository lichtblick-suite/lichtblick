// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import {
  AppBar,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  styled as muiStyled,
  TextField,
  Typography,
  TypographyProps,
} from "@mui/material";
import { Fzf, FzfResultItem } from "fzf";
import { useMemo, useState } from "react";

import { Topic } from "@foxglove/studio";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const topicToFzfResult = (item: Topic) =>
  ({
    item,
    score: 0,
    positions: new Set<number>(),
    start: 0,
    end: 0,
  } as FzfResultItem<Topic>);

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

const StyledAppBar = muiStyled(AppBar, { skipSx: true })(({ theme }) => ({
  top: -1,
  zIndex: theme.zIndex.appBar - 1,
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexDirection: "row",
  padding: theme.spacing(1),
  gap: theme.spacing(1),
  alignItems: "center",
}));

const StyledListItem = muiStyled(ListItem, { skipSx: true })(({ theme }) => ({
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
  "@media (pointer: fine)": {
    ".MuiListItemSecondaryAction-root": {
      visibility: "hidden",
    },
    "&:not(.loading):hover": {
      // paddingRight: theme.spacing(6),

      ".MuiListItemSecondaryAction-root": {
        visibility: "visible",
      },
    },
  },
}));

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;

export function TopicList(): JSX.Element {
  const [filterText, setFilterText] = useState<string>("");

  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const topics = useMessagePipeline((ctx) => ctx.playerState.activeData?.topics ?? []);

  const filteredTopics: FzfResultItem<Topic>[] = useMemo(
    () =>
      filterText
        ? new Fzf(topics, {
            fuzzy: filterText.length > 2 ? "v2" : false,
            sort: true,
            selector: (topic) => `${topic.name}|${topic.datatype}`,
          }).find(filterText)
        : topics.map((t) => topicToFzfResult(t)),
    [filterText, topics],
  );

  if (playerPresence === PlayerPresence.ERROR) {
    return (
      <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
        <Typography align="center" color="text.secondary">
          An error occurred
        </Typography>
      </Stack>
    );
  }

  if (playerPresence === PlayerPresence.INITIALIZING) {
    return (
      <>
        <StyledAppBar position="sticky" color="inherit" elevation={0}>
          <TextField
            disabled
            variant="filled"
            fullWidth
            placeholder="Waiting for data..."
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" />,
            }}
          />
        </StyledAppBar>
        <List key="loading" dense disablePadding>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
            <StyledListItem className="loading" divider key={i}>
              <ListItemText
                primary={<Skeleton animation={false} width="20%" />}
                secondary={<Skeleton animation="wave" width="55%" />}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </StyledListItem>
          ))}
        </List>
      </>
    );
  }

  return (
    <>
      <StyledAppBar position="sticky" color="inherit" elevation={0}>
        <Box flex="auto">
          <TextField
            disabled={playerPresence !== PlayerPresence.PRESENT}
            onChange={(event) => setFilterText(event.target.value)}
            value={filterText}
            variant="filled"
            fullWidth
            placeholder="Filter by topic or datatype"
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" />,
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
        </Box>
      </StyledAppBar>

      {filteredTopics.length > 0 ? (
        <List key="topics" dense disablePadding>
          {filteredTopics.map(({ item, positions }) => (
            <StyledListItem divider key={item.name}>
              <ListItemText
                primary={<HighlightChars str={item.name} indices={positions} />}
                primaryTypographyProps={{ noWrap: true, title: item.name }}
                secondary={
                  <HighlightChars
                    str={item.datatype}
                    indices={positions}
                    offset={item.name.length + 1}
                  />
                }
                secondaryTypographyProps={{
                  variant: "caption",
                  fontFamily: fonts.MONOSPACE,
                  noWrap: true,
                  title: item.datatype,
                }}
              />
            </StyledListItem>
          ))}
        </List>
      ) : (
        <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
          {playerPresence === PlayerPresence.PRESENT && (
            <Typography align="center" color="text.secondary">
              No topics or datatypes matching
              <br />
              {`“${filterText}”`}
            </Typography>
          )}
          {playerPresence === PlayerPresence.RECONNECTING && (
            <Typography align="center" color="text.secondary">
              Waiting for connection
            </Typography>
          )}
        </Stack>
      )}
    </>
  );
}
