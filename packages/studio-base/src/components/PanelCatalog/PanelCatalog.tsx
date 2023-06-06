// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { IconButton, TextField } from "@mui/material";
import fuzzySort from "fuzzysort";
import { countBy, isEmpty } from "lodash";
import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Stack from "@foxglove/studio-base/components/Stack";
import { PanelInfo, usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

import { PanelGrid } from "./PanelGrid";
import { PanelList } from "./PanelList";
import { PanelSelection } from "./types";

const useStyles = makeStyles()((theme) => {
  const { spacing, palette } = theme;
  return {
    toolbar: {
      position: "sticky",
      top: -0.5, // yep that's a half pixel to avoid a gap between the appbar and panel top
      zIndex: 100,
      display: "flex",
      justifyContent: "stretch",
      padding: theme.spacing(1.5),
      backgroundImage: `linear-gradient(to top, transparent, ${palette.background.paper} ${spacing(
        1.5,
      )}) !important`,
    },
    toolbarMenu: {
      backgroundImage: `linear-gradient(to top, transparent, ${palette.background.menu} ${spacing(
        1.5,
      )}) !important`,
    },
    toolbarGrid: {
      padding: theme.spacing(2),
    },
  };
});

// sanity checks to help panel authors debug issues
function verifyPanels(panels: readonly PanelInfo[]): void {
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

type Props = {
  onPanelSelect: (arg0: PanelSelection) => void;
  onDragStart?: () => void;
  selectedPanelType?: string;
  mode?: "grid" | "list";
  isMenu?: boolean;
};

export const PanelCatalog = forwardRef<HTMLDivElement, Props>(function PanelCatalog(
  props: Props,
  ref,
) {
  const { isMenu = false, onDragStart, onPanelSelect, selectedPanelType, mode = "list" } = props;
  const { classes, cx } = useStyles();
  const { t } = useTranslation("addPanel");

  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedPanelIdx, setHighlightedPanelIdx] = useState<number | undefined>();

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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

  const getFilteredPanels = useCallback(
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

  const { filteredRegularPanels, filteredPreconfiguredPanels } = useMemo(
    () => ({
      filteredRegularPanels: getFilteredPanels(allRegularPanels),
      filteredPreconfiguredPanels: getFilteredPanels(allPreconfiguredPanels),
    }),
    [getFilteredPanels, allRegularPanels, allPreconfiguredPanels],
  );

  const allFilteredPanels = useMemo(
    () => [...filteredPreconfiguredPanels, ...filteredRegularPanels],
    [filteredPreconfiguredPanels, filteredRegularPanels],
  );

  const highlightedPanel = useMemo(() => {
    return highlightedPanelIdx != undefined ? allFilteredPanels[highlightedPanelIdx] : undefined;
  }, [allFilteredPanels, highlightedPanelIdx]);

  const noResults = allFilteredPanels.length === 0;

  const onKeyDown = useCallback(
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

  return (
    <Stack fullHeight ref={ref}>
      <div
        className={cx(classes.toolbar, {
          [classes.toolbarMenu]: isMenu,
          [classes.toolbarGrid]: mode === "grid",
        })}
      >
        <TextField
          fullWidth
          placeholder={t("searchPanels")}
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={onKeyDown}
          autoFocus
          data-testid="panel-list-textfield"
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
        <PanelGrid
          searchQuery={searchQuery}
          filteredPanels={allFilteredPanels}
          onPanelSelect={onPanelSelect}
        />
      ) : (
        <PanelList
          searchQuery={searchQuery}
          filteredPanels={allFilteredPanels}
          selectedPanelType={selectedPanelType}
          highlightedPanelIdx={highlightedPanelIdx}
          onDragStart={onDragStart}
          onPanelSelect={onPanelSelect}
        />
      )}
      {noResults && (
        <Stack padding={2}>
          <EmptyState>{t("noPanelsMatchSearchCriteria")}</EmptyState>
        </Stack>
      )}
    </Stack>
  );
});
