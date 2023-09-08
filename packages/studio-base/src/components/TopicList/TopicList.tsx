// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { IconButton, List, ListItem, ListItemText, Skeleton, TextField } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AutoSizer } from "react-virtualized";
import { VariableSizeList } from "react-window";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";
import { useDebounce } from "use-debounce";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import { DirectTopicStatsUpdater } from "@foxglove/studio-base/components/DirectTopicStatsUpdater";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

import { MessagePathRow } from "./MessagePathRow";
import { TopicRow } from "./TopicRow";
import { useTopicListSearch } from "./useTopicListSearch";

const useStyles = makeStyles<void, "dragHandle">()((theme, _params, classes) => ({
  root: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
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
  startAdornment: {
    display: "flex",
  },
  dragHandle: {
    opacity: 0.6,
    cursor: "grab",
  },
}));

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;

export function TopicList(): JSX.Element {
  const { t } = useTranslation("topicList");
  const { classes, cx } = useStyles();
  const [undebouncedFilterText, setFilterText] = useState<string>("");
  const [debouncedFilterText] = useDebounce(undebouncedFilterText, 50);

  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const { topics, datatypes } = useDataSourceInfo();

  const listRef = useRef<VariableSizeList>(ReactNull);

  const treeItems = useTopicListSearch({
    topics,
    datatypes,
    filterText: debouncedFilterText,
  });

  useEffect(() => {
    // Discard cached row heights when the filter results change
    listRef.current?.resetAfterIndex(0);
  }, [treeItems]);

  if (playerPresence === PlayerPresence.NOT_PRESENT) {
    return <EmptyState>{t("noDataSourceSelected")}</EmptyState>;
  }

  if (playerPresence === PlayerPresence.ERROR) {
    return <EmptyState>{t("anErrorOccurred")}</EmptyState>;
  }

  if (playerPresence === PlayerPresence.INITIALIZING) {
    return (
      <>
        <header className={classes.appBar}>
          <TextField
            disabled
            variant="filled"
            fullWidth
            placeholder={t("waitingForData")}
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
    <div className={classes.root}>
      <header className={classes.appBar}>
        <TextField
          id="topic-filter"
          variant="filled"
          disabled={playerPresence !== PlayerPresence.PRESENT}
          onChange={(event) => {
            setFilterText(event.target.value);
          }}
          value={undebouncedFilterText}
          fullWidth
          placeholder={t("searchBarPlaceholder")}
          InputProps={{
            inputProps: { "data-testid": "topic-filter" },
            size: "small",
            startAdornment: (
              <label className={classes.startAdornment} htmlFor="topic-filter">
                <SearchIcon fontSize="small" />
              </label>
            ),
            endAdornment: undebouncedFilterText && (
              <IconButton
                size="small"
                title={t("clearFilter")}
                onClick={() => {
                  setFilterText("");
                }}
                edge="end"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
      </header>
      {treeItems.length > 0 ? (
        <div style={{ flex: "1 1 100%" }}>
          <AutoSizer>
            {({ width, height }) => (
              <VariableSizeList
                ref={listRef}
                width={width}
                height={height}
                itemCount={treeItems.length}
                itemSize={(index) => (treeItems[index]?.type === "topic" ? 50 : 28)}
                overscanCount={10}
              >
                {({ index, style }) => {
                  const treeItem = treeItems[index]!;
                  switch (treeItem.type) {
                    case "topic":
                      return <TopicRow style={style} topicResult={treeItem.item} />;
                    case "schema":
                      return <MessagePathRow style={style} messagePathResult={treeItem.item} />;
                  }
                }}
              </VariableSizeList>
            )}
          </AutoSizer>
        </div>
      ) : (
        <EmptyState>
          {playerPresence === PlayerPresence.PRESENT && undebouncedFilterText
            ? `${t("noTopicsOrDatatypesMatching")} \n “${undebouncedFilterText}”`
            : t("noTopicsAvailable")}
          {playerPresence === PlayerPresence.RECONNECTING && t("waitingForConnection")}
        </EmptyState>
      )}
      <DirectTopicStatsUpdater interval={6} />
    </div>
  );
}
