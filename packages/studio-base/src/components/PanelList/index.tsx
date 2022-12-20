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

import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Container,
  Fade,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import fuzzySort from "fuzzysort";
import { countBy, isEmpty } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import { useDrag } from "react-dnd";
import { MosaicDragType, MosaicPath } from "react-mosaic-component";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import TextHighlight from "@foxglove/studio-base/components/TextHighlight";
import {
  useCurrentLayoutActions,
  usePanelMosaicId,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelInfo, usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";
import {
  PanelConfig,
  MosaicDropTargetPosition,
  SavedProps,
  MosaicDropResult,
} from "@foxglove/studio-base/types/panels";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

const useStyles = makeStyles()((theme) => {
  return {
    fullHeight: {
      height: "100%",
    },
    imagePlaceholder: {
      paddingBottom: `${(200 / 280) * 100}%`,
      backgroundColor: theme.palette.background.default,
    },
    cardContent: {
      flex: "auto",
    },
    grab: {
      cursor: "grab",
    },
    grid: {
      display: "grid !important",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      gap: theme.spacing(2),
    },
    toolbar: {
      position: "sticky",
      top: -0.5, // yep that's a half pixel to avoid a gap between the appbar and panel top
      zIndex: 100,
      display: "flex",
      padding: theme.spacing(2),
      justifyContent: "stretch",
      backgroundImage: `linear-gradient(to top, transparent, ${
        theme.palette.background.paper
      } ${theme.spacing(1.5)}) !important`,
    },
  };
});

type DropDescription = {
  type: string;
  config?: PanelConfig;
  relatedConfigs?: SavedProps;
  position?: MosaicDropTargetPosition;
  path?: MosaicPath;
  tabId?: string;
};

type PanelItemProps = {
  mode?: "grid" | "list";
  panel: {
    type: string;
    title: string;
    description?: string;
    config?: PanelConfig;
    relatedConfigs?: SavedProps;
    thumbnail?: string;
    extensionNamespace?: ExtensionNamespace;
  };
  searchQuery: string;
  checked?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  mosaicId: string;
  onDrop: (arg0: DropDescription) => void;
};

function blurActiveElement() {
  // Clear focus from the panel menu button so that spacebar doesn't trigger
  // more panel additions.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function DraggablePanelItem({
  mode = "list",
  searchQuery,
  panel,
  onClick,
  onDrop,
  checked = false,
  highlighted = false,
  mosaicId,
}: PanelItemProps) {
  const { classes } = useStyles();
  const scrollRef = React.useRef<HTMLElement>(ReactNull);
  const [, connectDragSource] = useDrag<unknown, MosaicDropResult, never>({
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
    if (highlighted && scrollRef.current) {
      const highlightedItem = scrollRef.current.getBoundingClientRect();
      const scrollContainer = scrollRef.current.parentElement?.parentElement?.parentElement;
      if (scrollContainer) {
        const scrollContainerToTop = scrollContainer.getBoundingClientRect().top;

        const isInView =
          highlightedItem.top >= 0 &&
          highlightedItem.top >= scrollContainerToTop &&
          highlightedItem.top + 50 <= window.innerHeight;

        if (!isInView) {
          scrollRef.current.scrollIntoView();
        }
      }
    }
  }, [highlighted]);

  const mergedRef = useCallback(
    (el: HTMLElement | ReactNull) => {
      connectDragSource(el);
      scrollRef.current = el;
    },
    [connectDragSource, scrollRef],
  );

  const targetString = panel.extensionNamespace
    ? `${panel.title} [${panel.extensionNamespace}]`
    : panel.title;

  const onClickWithStopPropagation = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onClick();
    },
    [onClick],
  );

  switch (mode) {
    case "grid":
      return (
        <Card className={classes.fullHeight}>
          <CardActionArea
            ref={mergedRef}
            onClick={onClickWithStopPropagation}
            className={classes.fullHeight}
          >
            <Stack fullHeight>
              {panel.thumbnail != undefined ? (
                <CardMedia component="img" image={panel.thumbnail} alt={panel.title} />
              ) : (
                <div className={classes.imagePlaceholder} />
              )}
              <CardContent className={classes.cardContent}>
                <Typography variant="subtitle2" gutterBottom>
                  <span data-testid={`panel-menu-item ${panel.title}`}>
                    <TextHighlight targetStr={targetString} searchText={searchQuery} />
                  </span>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <TextHighlight targetStr={panel.description ?? ""} searchText={searchQuery} />
                </Typography>
              </CardContent>
            </Stack>
          </CardActionArea>
        </Card>
      );

    case "list":
      return (
        <Tooltip
          placement="right"
          enterDelay={200}
          TransitionComponent={Fade}
          title={
            <Stack paddingTop={0.25} style={{ width: 200 }}>
              {panel.thumbnail != undefined && <img src={panel.thumbnail} alt={panel.title} />}
              <Stack padding={1} gap={0.5}>
                <Typography variant="body2" fontWeight="bold">
                  {panel.title}
                </Typography>
                <Typography variant="body2" style={{ opacity: 0.6 }}>
                  {panel.description}
                </Typography>
              </Stack>
            </Stack>
          }
        >
          <ListItem disableGutters disablePadding selected={highlighted}>
            <ListItemButton
              className={classes.grab}
              disabled={checked}
              ref={mergedRef}
              onClick={onClickWithStopPropagation}
            >
              <ListItemText
                primary={
                  <span data-testid={`panel-menu-item ${panel.title}`}>
                    <TextHighlight targetStr={targetString} searchText={searchQuery} />
                  </span>
                }
                primaryTypographyProps={{ fontWeight: checked ? "bold" : undefined }}
              />
            </ListItemButton>
          </ListItem>
        </Tooltip>
      );
  }
}

export type PanelSelection = {
  type: string;
  config?: PanelConfig;
  relatedConfigs?: {
    [panelId: string]: PanelConfig;
  };
};

type Props = {
  mode?: "grid" | "list";
  onPanelSelect: (arg0: PanelSelection) => void;
  selectedPanelType?: string;
};

// sanity checks to help panel authors debug issues
function verifyPanels(panels: readonly PanelInfo[]) {
  const panelTypes: Map<string, PanelInfo> = new Map();
  for (const panel of panels) {
    const { title, type, config } = mightActuallyBePartial(panel);
    const dispName = title ?? type ?? "<unnamed>";
    if (type == undefined || type.length === 0) {
      throw new Error(`Panel component ${title} must declare a unique \`static panelType\``);
    }
    const existingPanel = mightActuallyBePartial(panelTypes.get(type));
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

const PanelList = React.forwardRef<HTMLDivElement, Props>((props: Props, ref) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedPanelIdx, setHighlightedPanelIdx] = React.useState<number | undefined>();
  const { mode, onPanelSelect, selectedPanelType } = props;
  const { classes } = useStyles();

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
      blurActiveElement();
    },
    [dropPanel],
  );

  const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);

    // When there is a search query, automatically highlight the first (0th) item.
    // When the user erases the query, remove the highlight.
    setHighlightedPanelIdx(query ? 0 : undefined);
  }, []);

  const panelCatalog = usePanelCatalog();

  const namespacedPanels = useMemo(() => {
    // Remove namespace if panel title is unique.
    const panels = panelCatalog.getPanels();
    const countByTitle = countBy(panels, (panel) => panel.title);
    return panels.map((panel) => {
      if ((countByTitle[panel.title] ?? 0) > 1) {
        return panel;
      } else {
        return { ...panel, namespace: undefined };
      }
    });
  }, [panelCatalog]);

  const { allRegularPanels, allPreconfiguredPanels } = useMemo(() => {
    const panels = namespacedPanels;
    const regular = panels.filter((panel) => !panel.config);
    const preconfigured = panels.filter((panel) => panel.config);
    const sortByTitle = (a: PanelInfo, b: PanelInfo) =>
      a.title.localeCompare(b.title, undefined, { ignorePunctuation: true, sensitivity: "base" });

    return {
      allRegularPanels: [...regular].sort(sortByTitle),
      allPreconfiguredPanels: [...preconfigured].sort(sortByTitle),
    };
  }, [namespacedPanels]);

  useEffect(() => {
    verifyPanels([...allRegularPanels, ...allPreconfiguredPanels]);
  }, [allRegularPanels, allPreconfiguredPanels]);

  const getFilteredPanels = React.useCallback(
    (panels: PanelInfo[]) => {
      return searchQuery.length > 0
        ? fuzzySort
            .go(searchQuery, panels, {
              keys: ["title", "description"],
              // Weigh title matches more heavily than description matches.
              scoreFn: (a) => Math.max(a[0] ? a[0].score : -1000, a[1] ? a[1].score - 100 : -1000),
              threshold: -900,
            })
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
      // Prevent key down events from triggering the parent menu, if any.
      if (e.key !== "Escape") {
        e.stopPropagation();
      }

      if (mode === "grid") {
        return;
      }
      if (e.key === "ArrowDown") {
        setHighlightedPanelIdx((existing) => {
          if (existing == undefined) {
            return 0;
          }
          return (existing + 1) % allFilteredPanels.length;
        });
      } else if (e.key === "ArrowUp") {
        setHighlightedPanelIdx((existing) => {
          // nothing to highlight if there are no entries
          if (allFilteredPanels.length <= 0) {
            return undefined;
          }

          if (existing == undefined) {
            return allFilteredPanels.length - 1;
          }
          return (existing - 1 + allFilteredPanels.length) % allFilteredPanels.length;
        });
      } else if (e.key === "Enter" && highlightedPanel) {
        onPanelSelect({
          type: highlightedPanel.type,
          config: highlightedPanel.config,
          relatedConfigs: highlightedPanel.relatedConfigs,
        });
      }
    },
    [allFilteredPanels.length, highlightedPanel, mode, onPanelSelect],
  );

  const displayPanelListItem = React.useCallback(
    (panelInfo: PanelInfo) => {
      const { title, type, config, relatedConfigs } = panelInfo;
      return (
        <DraggablePanelItem
          mode={mode}
          key={`${type}-${title}`}
          mosaicId={mosaicId}
          panel={panelInfo}
          onDrop={onPanelMenuItemDrop}
          onClick={() => {
            onPanelSelect({ type, config, relatedConfigs });
            blurActiveElement();
          }}
          checked={type === selectedPanelType}
          highlighted={highlightedPanel?.title === title}
          searchQuery={searchQuery}
        />
      );
    },
    [
      highlightedPanel?.title,
      mode,
      mosaicId,
      onPanelMenuItemDrop,
      onPanelSelect,
      searchQuery,
      selectedPanelType,
    ],
  );

  return (
    <div className={classes.fullHeight} ref={ref}>
      <div className={classes.toolbar}>
        <TextField
          fullWidth
          placeholder="Search panels"
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={onKeyDown}
          onBlur={() => setHighlightedPanelIdx(undefined)}
          autoFocus
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" color="primary" />,
            endAdornment: searchQuery && (
              <IconButton size="small" edge="end" onClick={() => setSearchQuery("")}>
                <CloseIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
      </div>
      {mode === "grid" ? (
        <Container className={classes.grid} maxWidth={false}>
          {allFilteredPanels.map(displayPanelListItem)}
        </Container>
      ) : (
        <List dense disablePadding>
          {allFilteredPanels.map(displayPanelListItem)}
        </List>
      )}
      {noResults && (
        <Stack alignItems="center" justifyContent="center" paddingX={1} paddingY={2}>
          <Typography variant="body2" color="text.secondary">
            No panels match search criteria.
          </Typography>
        </Stack>
      )}
    </div>
  );
});
PanelList.displayName = "Panel List";

export default PanelList;
