// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Divider,
  Menu,
  MenuItem as MuiMenuItem,
  PaperProps,
  PopoverPosition,
  PopoverReference,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";
import { shallow } from "zustand/shallow";

import { AppBarMenuItem } from "@foxglove/studio-base/components/AppBar/types";
import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import { useCurrentUserType } from "@foxglove/studio-base/context/CurrentUserContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import {
  WorkspaceContextStore,
  useWorkspaceStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import { NestedMenuItem } from "./NestedMenuItem";

type AppMenuProps = {
  handleClose: () => void;
  anchorEl?: HTMLElement;
  anchorReference?: PopoverReference;
  anchorPosition?: PopoverPosition;
  disablePortal?: boolean;
  open: boolean;
};

const useStyles = makeStyles()({
  menuList: {
    minWidth: 180,
    maxWidth: 220,
  },
  truncate: {
    alignSelf: "center !important",
  },
});

const selectWorkspace = (store: WorkspaceContextStore) => store;

export function AppMenu(props: AppMenuProps): JSX.Element {
  const { open, handleClose, anchorEl, anchorReference, anchorPosition, disablePortal } = props;
  const { classes } = useStyles();
  const { t } = useTranslation("appBar");

  const { appBarMenuItems } = useAppContext();

  const [nestedMenu, setNestedMenu] = useState<string | undefined>();

  const currentUserType = useCurrentUserType();
  const analytics = useAnalytics();

  const { recentSources, selectRecent } = usePlayerSelection();
  const {
    sidebars: {
      left: { open: leftSidebarOpen },
      right: { open: rightSidebarOpen },
    },
  } = useWorkspaceStore(selectWorkspace, shallow);
  const { sidebarActions, dialogActions, layoutActions } = useWorkspaceActions();

  const handleNestedMenuClose = useCallback(() => {
    setNestedMenu(undefined);
    handleClose();
  }, [handleClose]);

  const handleItemPointerEnter = useCallback((id: string) => {
    setNestedMenu(id);
  }, []);

  const handleAnalytics = useCallback(
    (cta: string) => {
      void analytics.logEvent(AppEvent.APP_MENU_CLICK, {
        user: currentUserType,
        cta,
      });
    },
    [analytics, currentUserType],
  );

  // FILE

  const fileItems = useMemo(() => {
    const items: AppBarMenuItem[] = [
      {
        type: "item",
        label: t("open"),
        key: "open",
        onClick: () => {
          dialogActions.dataSource.open("start");
          handleAnalytics("open-data-source-dialog");
          handleNestedMenuClose();
        },
      },
      {
        type: "item",
        label: t("openLocalFile"),
        key: "open-file",
        onClick: () => {
          handleAnalytics("open-file");
          handleNestedMenuClose();
          dialogActions.openFile.open().catch(console.error);
        },
      },
      {
        type: "item",
        label: t("openConnection"),
        key: "open-connection",
        onClick: () => {
          dialogActions.dataSource.open("connection");
          handleAnalytics("open-connection");
          handleNestedMenuClose();
        },
      },
      { type: "divider" },
      { type: "item", label: t("recentDataSources"), key: "recent-sources", disabled: true },
    ];

    recentSources.slice(0, 5).map((recent) => {
      items.push({
        type: "item",
        key: recent.id,
        onClick: () => {
          handleAnalytics("open-recent");
          selectRecent(recent.id);
          handleNestedMenuClose();
        },
        label: <TextMiddleTruncate text={recent.title} className={classes.truncate} />,
      });
    });

    return items;
  }, [
    classes.truncate,
    dialogActions.dataSource,
    dialogActions.openFile,
    handleAnalytics,
    handleNestedMenuClose,
    recentSources,
    selectRecent,
    t,
  ]);

  // VIEW

  const viewItems = useMemo<AppBarMenuItem[]>(
    () => [
      {
        type: "item",
        label: leftSidebarOpen ? t("hideLeftSidebar") : t("showLeftSidebar"),
        key: "left-sidebar",
        shortcut: "[",
        onClick: () => {
          sidebarActions.left.setOpen(!leftSidebarOpen);
          handleNestedMenuClose();
        },
      },
      {
        type: "item",
        label: rightSidebarOpen ? t("hideRightSidebar") : t("showRightSidebar"),
        key: "right-sidebar",
        shortcut: "]",
        onClick: () => {
          sidebarActions.right.setOpen(!rightSidebarOpen);
          handleNestedMenuClose();
        },
      },
      {
        type: "divider",
      },
      {
        type: "item",
        label: t("importLayoutFromFile"),
        key: "import-layout",
        onClick: () => {
          layoutActions.importFromFile();
          handleNestedMenuClose();
        },
      },
      {
        type: "item",
        label: t("exportLayoutToFile"),
        key: "export-layout",
        onClick: () => {
          layoutActions.exportToFile();
          handleNestedMenuClose();
        },
      },
    ],
    [
      handleNestedMenuClose,
      layoutActions,
      leftSidebarOpen,
      rightSidebarOpen,
      sidebarActions.left,
      sidebarActions.right,
      t,
    ],
  );

  // HELP

  const onAboutClick = useCallback(() => {
    dialogActions.preferences.open("about");
    handleAnalytics("about");
    handleNestedMenuClose();
  }, [dialogActions.preferences, handleAnalytics, handleNestedMenuClose]);

  const onDocsClick = useCallback(() => {
    handleAnalytics("docs");
    window.open("https://foxglove.dev/docs", "_blank");
    handleNestedMenuClose();
  }, [handleAnalytics, handleNestedMenuClose]);

  const onSlackClick = useCallback(() => {
    handleAnalytics("join-slack");
    window.open("https://foxglove.dev/slack", "_blank");
    handleNestedMenuClose();
  }, [handleAnalytics, handleNestedMenuClose]);

  const onDemoClick = useCallback(() => {
    dialogActions.dataSource.open("demo");
    handleAnalytics("demo");
    handleNestedMenuClose();
  }, [dialogActions.dataSource, handleAnalytics, handleNestedMenuClose]);

  const helpItems = useMemo<AppBarMenuItem[]>(
    () => [
      { type: "item", key: "about", label: t("about"), onClick: onAboutClick },
      { type: "divider" },
      { type: "item", key: "docs", label: t("viewOurDocs"), onClick: onDocsClick, external: true },
      {
        type: "item",
        key: "join-slack",
        label: t("joinOurSlack"),
        onClick: onSlackClick,
        external: true,
      },
      { type: "divider" },
      { type: "item", key: "demo", label: t("exploreSampleData"), onClick: onDemoClick },
    ],
    [onAboutClick, onDemoClick, onDocsClick, onSlackClick, t],
  );

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        anchorReference={anchorReference}
        anchorPosition={anchorPosition}
        disablePortal={disablePortal}
        id="app-menu"
        open={open}
        disableAutoFocusItem
        onClose={handleNestedMenuClose}
        MenuListProps={{
          "aria-labelledby": "app-menu-button",
          dense: true,
          className: classes.menuList,
        }}
        PaperProps={
          {
            "data-tourid": "app-menu",
          } as Partial<PaperProps & { "data-tourid"?: string }>
        }
      >
        {(appBarMenuItems ?? []).map((item, idx) =>
          item.type === "divider" ? (
            <Divider key={`divider${idx}`} />
          ) : (
            <MuiMenuItem
              key={item.key}
              onClick={item.onClick}
              onPointerEnter={() => setNestedMenu(undefined)}
            >
              {item.label}
            </MuiMenuItem>
          ),
        )}
        <NestedMenuItem
          onPointerEnter={handleItemPointerEnter}
          items={fileItems}
          open={nestedMenu === "app-menu-file"}
          id="app-menu-file"
        >
          {t("file")}
        </NestedMenuItem>
        <NestedMenuItem
          onPointerEnter={handleItemPointerEnter}
          items={viewItems}
          open={nestedMenu === "app-menu-view"}
          id="app-menu-view"
        >
          {t("view")}
        </NestedMenuItem>
        <NestedMenuItem
          onPointerEnter={handleItemPointerEnter}
          items={helpItems}
          open={nestedMenu === "app-menu-help"}
          id="app-menu-help"
        >
          {t("help")}
        </NestedMenuItem>
      </Menu>
    </>
  );
}
