// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { makeStyles, useTheme } from "@fluentui/react";
import MagnifyIcon from "@mdi/svg/svg/magnify.svg";
import fuzzySort from "fuzzysort";
import { isEmpty } from "lodash";
import { useEffect, useMemo } from "react";
import { useDrag } from "react-dnd";
import { MosaicDragType, MosaicPath } from "react-mosaic-component";

import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";
import { Item } from "@foxglove/studio-base/components/Menu";
import TextHighlight from "@foxglove/studio-base/components/TextHighlight";
import {
  useCurrentLayoutActions,
  usePanelMosaicId,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelInfo, usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  PanelConfig,
  MosaicDropTargetPosition,
  SavedProps,
  MosaicDropResult,
} from "@foxglove/studio-base/types/panels";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles((theme) => ({
  root: {
    height: "100%",
  },
  container: {
    padding: 16,
  },
  item: {
    cursor: "grab",
  },
  sticky: {
    color: colors.LIGHT,
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
  searchInputContainer: {
    paddingLeft: 8,
    backgroundColor: theme.semanticColors.inputBackground,
    borderRadius: 4,
    border: `1px solid ${theme.semanticColors.inputBorder}`,
  },
  searchInput: {
    backgroundColor: `${theme.semanticColors.inputBackground} !important`,
    padding: "8px !important",
    margin: "0 !important",
    width: "100%",
    minWidth: 0,

    ":hover, :focus": {
      backgroundColor: theme.semanticColors.inputBackground,
    },
  },
  scrollContainer: {
    overflowY: "auto",
    height: "100%",
  },
  noResults: {
    padding: "8px 16px",
    opacity: 0.4,
  },
}));

type DropDescription = {
  type: string;
  config?: PanelConfig;
  relatedConfigs?: SavedProps;
  position?: MosaicDropTargetPosition;
  path?: MosaicPath;
  tabId?: string;
};

type PanelItemProps = {
  panel: {
    type: string;
    title: string;
    config?: PanelConfig;
    relatedConfigs?: SavedProps;
  };
  searchQuery: string;
  checked?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  mosaicId: string;
  onDrop: (arg0: DropDescription) => void;
};

function DraggablePanelItem({
  searchQuery,
  panel,
  onClick,
  onDrop,
  checked,
  highlighted,
  mosaicId,
}: PanelItemProps) {
  const classes = useStyles();
  const scrollRef = React.useRef<HTMLDivElement>(ReactNull);
  const [, drag] = useDrag<unknown, MosaicDropResult, never>({
    type: MosaicDragType.WINDOW,
    // mosaicId is needed for react-mosaic to accept the drop
    item: () => ({ mosaicId }),
    options: { dropEffect: "copy" },
    end: (_item, monitor) => {
      const dropResult = monitor.getDropResult() ?? {};
      const { position, path, tabId } = dropResult;
      // dropping outside mosaic does nothing. If we have a tabId, but no
      // position or path, we're dragging into an empty tab.
      if ((position == undefined || path == undefined) && tabId == undefined) {
        // when dragging a panel into an empty layout treat it link clicking the panel
        // mosaic doesn't give us a position or path to invoke onDrop
        onClick();
        return;
      }
      const { type, config, relatedConfigs } = panel;
      onDrop({ type, config, relatedConfigs, position, path, tabId });
    },
  });

  React.useEffect(() => {
    if (highlighted === true && scrollRef.current) {
      const highlightedItem = scrollRef.current.getBoundingClientRect();
      const scrollContainer = scrollRef.current.parentElement?.parentElement?.parentElement;
      if (scrollContainer) {
        const scrollContainerToTop = scrollContainer.getBoundingClientRect().top;

        const isInView =
          highlightedItem.top >= 0 &&
          highlightedItem.top >= scrollContainerToTop &&
          highlightedItem.top + 50 <= window.innerHeight;

        if (!isInView) {
          scrollRef.current?.scrollIntoView();
        }
      }
    }
  }, [highlighted]);

  return (
    <div ref={drag}>
      <div ref={scrollRef}>
        <Item
          onClick={onClick}
          checked={checked}
          highlighted={highlighted}
          className={classes.item}
          dataTest={`panel-menu-item ${panel.title}`}
        >
          <TextHighlight targetStr={panel.title} searchText={searchQuery} />
        </Item>
      </div>
    </div>
  );
}

export type PanelSelection = {
  type: string;
  config?: PanelConfig;
  relatedConfigs?: {
    [panelId: string]: PanelConfig;
  };
};
type Props = {
  onPanelSelect: (arg0: PanelSelection) => void;
  selectedPanelTitle?: string;
};

// sanity checks to help panel authors debug issues
function verifyPanels(panels: readonly PanelInfo[]) {
  const panelTypes: Map<string, PanelInfo> = new Map();
  for (const panel of panels) {
    const { title, type, config } = panel;
    const dispName = title ?? type ?? "<unnamed>";
    if (type.length === 0) {
      throw new Error(`Panel component ${title} must declare a unique \`static panelType\``);
    }
    const existingPanel = panelTypes.get(type);
    if (existingPanel) {
      const bothHaveEmptyConfigs = isEmpty(existingPanel.config) && isEmpty(config);
      if (bothHaveEmptyConfigs) {
        const otherDisplayName = existingPanel.title ?? existingPanel.type ?? "<unnamed>";
        throw new Error(
          `Two components have the same panelType ('${type}') and no preset configs: ${otherDisplayName} and ${dispName}`,
        );
      }
    }
    panelTypes.set(type, panel);
  }
}

function PanelList(props: Props): JSX.Element {
  const theme = useTheme();
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedPanelIdx, setHighlightedPanelIdx] = React.useState<number | undefined>();
  const { onPanelSelect, selectedPanelTitle } = props;

  const { dropPanel } = useCurrentLayoutActions();
  const mosaicId = usePanelMosaicId();

  // Update panel layout when a panel menu item is dropped;
  // actual operations to change layout supplied by react-mosaic-component
  const onPanelMenuItemDrop = React.useCallback(
    ({ config, relatedConfigs, type, position, path, tabId }: DropDescription) => {
      dropPanel({
        newPanelType: type,
        destinationPath: path,
        position,
        tabId,
        config,
        relatedConfigs,
      });
    },
    [dropPanel],
  );

  const handleSearchChange = React.useCallback((e: React.SyntheticEvent<HTMLInputElement>) => {
    setSearchQuery(e.currentTarget.value);
    setHighlightedPanelIdx(0);
  }, []);

  const panelCatalog = usePanelCatalog();
  const { allRegularPanels, allPreconfiguredPanels } = useMemo(() => {
    const panels = panelCatalog.getPanels();
    const regular = panels.filter((panel) => panel.preconfigured !== true);
    const preconfigured = panels.filter((panel) => panel.preconfigured === true);
    const sortByTitle = (a: PanelInfo, b: PanelInfo) =>
      a.title.localeCompare(b.title, undefined, { ignorePunctuation: true, sensitivity: "base" });

    return {
      allRegularPanels: [...regular].sort(sortByTitle),
      allPreconfiguredPanels: [...preconfigured].sort(sortByTitle),
    };
  }, [panelCatalog]);

  useEffect(() => {
    verifyPanels([...allRegularPanels, ...allPreconfiguredPanels]);
  }, [allRegularPanels, allPreconfiguredPanels]);

  const getFilteredPanels = React.useCallback(
    (panels: PanelInfo[]) => {
      return searchQuery.length > 0
        ? fuzzySort
            .go(searchQuery, panels, { key: "title" })
            .map((searchResult) => searchResult.obj)
        : panels;
    },
    [searchQuery],
  );

  const { filteredRegularPanels, filteredPreconfiguredPanels } = React.useMemo(
    () => ({
      filteredRegularPanels: getFilteredPanels(allRegularPanels),
      filteredPreconfiguredPanels: getFilteredPanels(allPreconfiguredPanels),
    }),
    [getFilteredPanels, allRegularPanels, allPreconfiguredPanels],
  );

  const allFilteredPanels = React.useMemo(
    () => [...filteredPreconfiguredPanels, ...filteredRegularPanels],
    [filteredPreconfiguredPanels, filteredRegularPanels],
  );

  const highlightedPanel = React.useMemo(() => {
    return highlightedPanelIdx != undefined ? allFilteredPanels[highlightedPanelIdx] : undefined;
  }, [allFilteredPanels, highlightedPanelIdx]);

  const noResults = allFilteredPanels.length === 0;

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" && highlightedPanelIdx != undefined) {
        setHighlightedPanelIdx((highlightedPanelIdx + 1) % allFilteredPanels.length);
      } else if (e.key === "ArrowUp" && highlightedPanelIdx != undefined) {
        const newIdx = (highlightedPanelIdx - 1) % (allFilteredPanels.length - 1);
        setHighlightedPanelIdx(newIdx >= 0 ? newIdx : allFilteredPanels.length + newIdx);
      } else if (e.key === "Enter" && highlightedPanel) {
        onPanelSelect({
          type: highlightedPanel.type,
          config: highlightedPanel.config,
          relatedConfigs: highlightedPanel.relatedConfigs,
        });
      }
    },
    [allFilteredPanels.length, highlightedPanel, highlightedPanelIdx, onPanelSelect],
  );

  const displayPanelListItem = React.useCallback(
    ({ title, type, config, relatedConfigs }: PanelInfo) => {
      return (
        <DraggablePanelItem
          key={`${type}-${title}`}
          mosaicId={mosaicId}
          panel={{ type, title, config, relatedConfigs }}
          onDrop={onPanelMenuItemDrop}
          onClick={() => onPanelSelect({ type, config, relatedConfigs })}
          checked={title === selectedPanelTitle}
          highlighted={highlightedPanel?.title === title}
          searchQuery={searchQuery}
        />
      );
    },
    [
      highlightedPanel,
      mosaicId,
      onPanelMenuItemDrop,
      onPanelSelect,
      searchQuery,
      selectedPanelTitle,
    ],
  );

  return (
    <div className={classes.root}>
      <div className={classes.sticky}>
        <div className={classes.container}>
          <Flex center className={classes.searchInputContainer}>
            <Icon style={{ color: theme.semanticColors.inputIcon }}>
              <MagnifyIcon />
            </Icon>
            <LegacyInput
              className={classes.searchInput}
              placeholder="Search panels"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={onKeyDown}
              onBlur={() => setHighlightedPanelIdx(undefined)}
              onFocus={() => setHighlightedPanelIdx(0)}
              autoFocus
            />
          </Flex>
        </div>
      </div>
      <div className={classes.scrollContainer}>
        {noResults && <div className={classes.noResults}>No panels match search criteria.</div>}
        {allFilteredPanels.map(displayPanelListItem)}
      </div>
    </div>
  );
}

export default PanelList;
