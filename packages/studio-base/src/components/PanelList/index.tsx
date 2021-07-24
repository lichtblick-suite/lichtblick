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
import MagnifyIcon from "@mdi/svg/svg/magnify.svg";
import fuzzySort from "fuzzysort";
import { useEffect, useMemo } from "react";
import { useDrag } from "react-dnd";
import { MosaicDragType, MosaicPath } from "react-mosaic-component";
import styled from "styled-components";

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

import styles from "./index.module.scss";

const StickyDiv = styled.div`
  color: ${colors.LIGHT};
  position: sticky;
  top: 0;
  z-index: 2;
`;

const SSearchInputContainer = styled(Flex)`
  padding-left: 8px;
  background-color: ${colors.DARK5};
  border-radius: 4px;
`;

const SSearchInput = styled(LegacyInput)`
  background-color: ${colors.DARK5};
  padding: 8px;
  width: 100%;
  min-width: 0;
  margin: 0;

  &:hover,
  &:focus {
    background-color: ${colors.DARK5};
  }
`;

const SScrollContainer = styled.div`
  overflow-y: auto;
  height: 100%;
`;

const SEmptyState = styled.div`
  padding: 0px 16px 16px;
  opacity: 0.4;
`;

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
          className={styles.item}
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
    const { title, type } = panel;
    const existingPanel = panelTypes.get(type);
    if (existingPanel) {
      throw new Error(
        `Two components have the same type ('${type}'): ${existingPanel.title} and ${title}`,
      );
    }
    panelTypes.set(type, panel);
  }
}

function PanelList(props: Props): JSX.Element {
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
  const allPanels = useMemo(() => {
    return [...panelCatalog.getPanels()].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { ignorePunctuation: true, sensitivity: "base" }),
    );
  }, [panelCatalog]);

  useEffect(() => {
    verifyPanels(allPanels);
  }, [allPanels]);

  const filteredPanels = React.useMemo(() => {
    return searchQuery.length > 0
      ? fuzzySort
          .go(searchQuery, allPanels, { key: "title" })
          .map((searchResult) => searchResult.obj)
      : allPanels;
  }, [allPanels, searchQuery]);

  const highlightedPanel = React.useMemo(
    () => (highlightedPanelIdx != undefined ? filteredPanels[highlightedPanelIdx] : undefined),
    [filteredPanels, highlightedPanelIdx],
  );

  const noResults = filteredPanels.length === 0;

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" && highlightedPanelIdx != undefined) {
        setHighlightedPanelIdx((highlightedPanelIdx + 1) % filteredPanels.length);
      } else if (e.key === "ArrowUp" && highlightedPanelIdx != undefined) {
        const newIdx = (highlightedPanelIdx - 1) % (filteredPanels.length - 1);
        setHighlightedPanelIdx(newIdx >= 0 ? newIdx : filteredPanels.length + newIdx);
      } else if (e.key === "Enter" && highlightedPanel) {
        onPanelSelect({
          type: highlightedPanel.type,
        });
      }
    },
    [filteredPanels.length, highlightedPanel, highlightedPanelIdx, onPanelSelect],
  );

  const displayPanelListItem = React.useCallback(
    ({ title, type }: PanelInfo) => {
      return (
        <DraggablePanelItem
          key={`${type}-${title}`}
          mosaicId={mosaicId}
          panel={{
            type,
            title,
          }}
          onDrop={onPanelMenuItemDrop}
          onClick={() => onPanelSelect({ type })}
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
    <div style={{ height: "100%", overflow: "hidden" }}>
      <StickyDiv>
        <div style={{ padding: "16px" }}>
          <SSearchInputContainer center>
            <Icon style={{ color: colors.LIGHT, opacity: 0.3 }}>
              <MagnifyIcon />
            </Icon>
            <SSearchInput
              placeholder="Search panels"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={onKeyDown}
              onBlur={() => setHighlightedPanelIdx(undefined)}
              onFocus={() => setHighlightedPanelIdx(0)}
              autoFocus
            />
          </SSearchInputContainer>
        </div>
      </StickyDiv>
      <SScrollContainer>
        {noResults && <SEmptyState>No panels match search criteria.</SEmptyState>}
        {filteredPanels.map(displayPanelListItem)}
      </SScrollContainer>
    </div>
  );
}

export default PanelList;
