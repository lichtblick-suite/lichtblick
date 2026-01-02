// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import SearchIcon from "@mui/icons-material/Search";
import { List, ListItem, ListItemText, PopoverPosition, Skeleton } from "@mui/material";
import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLatest } from "react-use";
import AutoSizer from "react-virtualized-auto-sizer";
import { ListChildComponentProps, VariableSizeList } from "react-window";
import { useDebounce } from "use-debounce";

import { filterMap } from "@lichtblick/den/collection";
import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { DirectTopicStatsUpdater } from "@lichtblick/suite-base/components/DirectTopicStatsUpdater";
import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import SearchBar from "@lichtblick/suite-base/components/SearchBar/SearchBar";
import { ContextMenu } from "@lichtblick/suite-base/components/TopicList/ContextMenu";
import { getDraggedMessagePath } from "@lichtblick/suite-base/components/TopicList/getDraggedMessagePath";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { MessagePathSelectionProvider } from "@lichtblick/suite-base/services/messagePathDragging/MessagePathSelectionProvider";

import { MessagePathRow } from "./MessagePathRow";
import { useStyles } from "./TopicList.style";
import { TopicRow } from "./TopicRow";
import { useMultiSelection } from "./useMultiSelection";
import { useTopicListSearch } from "./useTopicListSearch";

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;

export function TopicList(): React.JSX.Element {
  const { t } = useTranslation("topicList");
  const { classes } = useStyles();
  const [undebouncedFilterText, setFilterText] = useState<string>("");
  const [debouncedFilterText] = useDebounce(undebouncedFilterText, 50);
  const onClear = () => {
    setFilterText("");
  };

  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const { topics, datatypes } = useDataSourceInfo();

  const listRef = useRef<VariableSizeList>(ReactNull);

  const treeItems = useTopicListSearch({
    topics,
    datatypes,
    filterText: debouncedFilterText,
  });
  const { selectedIndexes, onSelect, getSelectedIndexes } = useMultiSelection(treeItems);

  const [contextMenuState, setContextMenuState] = useState<
    { position: PopoverPosition; items: DraggedMessagePath[] } | undefined
  >(undefined);

  const latestTreeItems = useLatest(treeItems);

  const getSelectedItemsAsDraggedMessagePaths = useCallback(() => {
    return filterMap(
      Array.from(getSelectedIndexes()).sort(),
      (index): DraggedMessagePath | undefined => {
        const item = latestTreeItems.current[index];
        return item ? getDraggedMessagePath(item) : undefined;
      },
    );
  }, [getSelectedIndexes, latestTreeItems]);

  const handleContextMenu = useCallback(
    (event: MouseEvent, index: number) => {
      event.preventDefault();

      const latestSelectedIndexes = getSelectedIndexes();
      // Select only the clicked item if it was not already selected
      if (!latestSelectedIndexes.has(index)) {
        onSelect({ index, modKey: false, shiftKey: false });
      }
      setContextMenuState({
        position: { left: event.clientX, top: event.clientY },
        items: getSelectedItemsAsDraggedMessagePaths(),
      });
    },
    [getSelectedIndexes, getSelectedItemsAsDraggedMessagePaths, onSelect],
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenuState(undefined);
  }, []);

  useEffect(() => {
    // Discard cached row heights when the filter results change
    listRef.current?.resetAfterIndex(0);
  }, [treeItems]);

  const itemData = useMemo(() => ({ treeItems, selectedIndexes }), [selectedIndexes, treeItems]);

  const renderRow: React.FC<ListChildComponentProps<typeof itemData>> = useCallback(
    // `data` comes from the `itemData` we pass to the VariableSizeList below
    ({ index, style, data }) => {
      const treeItem = data.treeItems[index]!;
      const selected = data.selectedIndexes.has(index);
      const onClick = (event: React.MouseEvent) => {
        event.preventDefault();
        onSelect({
          index,
          modKey: event.metaKey || event.ctrlKey,
          shiftKey: event.shiftKey,
        });
      };
      switch (treeItem.type) {
        case "topic":
          return (
            <TopicRow
              style={style}
              topicResult={treeItem.item}
              selected={selected}
              onClick={onClick}
              onContextMenu={(event) => {
                handleContextMenu(event, index);
              }}
            />
          );
        case "schema":
          return (
            <MessagePathRow
              style={style}
              messagePathResult={treeItem.item}
              selected={selected}
              onClick={onClick}
              onContextMenu={(event) => {
                handleContextMenu(event, index);
              }}
            />
          );
      }
    },
    [handleContextMenu, onSelect],
  );

  if (playerPresence === PlayerPresence.NOT_PRESENT) {
    return <EmptyState>{t("noDataSourceSelected")}</EmptyState>;
  }

  if (playerPresence === PlayerPresence.ERROR) {
    return <EmptyState>{t("anErrorOccurred")}</EmptyState>;
  }

  if (playerPresence === PlayerPresence.INITIALIZING) {
    return (
      <>
        <header className={classes.filterBar}>
          <SearchBar
            disabled
            variant="filled"
            fullWidth
            placeholder={t("waitingForData")}
            slotProps={{
              input: {
                size: "small",
                startAdornment: <SearchIcon fontSize="small" />,
              },
            }}
          />
        </header>
        <List dense disablePadding>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
            <ListItem divider key={i}>
              <ListItemText
                className={classes.skeletonText}
                primary={<Skeleton animation={false} width="20%" />}
                secondary={<Skeleton animation="wave" width="55%" />}
                slotProps={{ secondary: { variant: "caption" } }}
              />
            </ListItem>
          ))}
        </List>
      </>
    );
  }

  return (
    <MessagePathSelectionProvider getSelectedItems={getSelectedItemsAsDraggedMessagePaths}>
      <div className={classes.root}>
        <SearchBar
          id="topic-filter"
          placeholder={t("searchBarPlaceholder")}
          disabled={playerPresence !== PlayerPresence.PRESENT}
          onChange={(event) => {
            setFilterText(event.target.value);
          }}
          value={undebouncedFilterText}
          showClearIcon={!!debouncedFilterText}
          onClear={onClear}
        />
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
                  itemData={itemData}
                  overscanCount={10}
                >
                  {renderRow}
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
      {contextMenuState && (
        <ContextMenu
          onClose={handleContextMenuClose}
          anchorPosition={contextMenuState.position}
          messagePaths={contextMenuState.items}
        />
      )}
    </MessagePathSelectionProvider>
  );
}
