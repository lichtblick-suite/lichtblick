// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Link, Typography } from "@mui/material";
import { t } from "i18next";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import Logger from "@lichtblick/log";
import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useStyles } from "@lichtblick/suite-base/Workspace.style";
import AccountSettings from "@lichtblick/suite-base/components/AccountSettingsSidebar/AccountSettings";
import { AlertsList } from "@lichtblick/suite-base/components/AlertsList";
import { AppBar } from "@lichtblick/suite-base/components/AppBar";
import {
  DataSourceDialog,
  DataSourceDialogItem,
} from "@lichtblick/suite-base/components/DataSourceDialog";
import DataSourceSidebar from "@lichtblick/suite-base/components/DataSourceSidebar/DataSourceSidebar";
import DocumentDropListener from "@lichtblick/suite-base/components/DocumentDropListener";
import { EventsList } from "@lichtblick/suite-base/components/EventsList";
import ExtensionsSettings from "@lichtblick/suite-base/components/ExtensionsSettings";
import KeyListener from "@lichtblick/suite-base/components/KeyListener";
import LayoutBrowser from "@lichtblick/suite-base/components/LayoutBrowser";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { PanelCatalog } from "@lichtblick/suite-base/components/PanelCatalog";
import PanelLayout from "@lichtblick/suite-base/components/PanelLayout";
import PanelSettings from "@lichtblick/suite-base/components/PanelSettings";
import PlaybackControls from "@lichtblick/suite-base/components/PlaybackControls";
import RemountOnValueChange from "@lichtblick/suite-base/components/RemountOnValueChange";
import { SidebarContent } from "@lichtblick/suite-base/components/SidebarContent";
import Sidebars from "@lichtblick/suite-base/components/Sidebars";
import { SidebarItem } from "@lichtblick/suite-base/components/Sidebars/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import {
  StudioLogsSettings,
  StudioLogsSettingsSidebar,
} from "@lichtblick/suite-base/components/StudioLogsSettings";
import { SyncAdapters } from "@lichtblick/suite-base/components/SyncAdapters";
import { TopicList } from "@lichtblick/suite-base/components/TopicList";
import VariablesList from "@lichtblick/suite-base/components/VariablesList";
import { WorkspaceDialogs } from "@lichtblick/suite-base/components/WorkspaceDialogs";
import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import { useAppContext } from "@lichtblick/suite-base/context/AppContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  useCurrentUser,
  useCurrentUserType,
} from "@lichtblick/suite-base/context/CurrentUserContext";
import { EventsStore, useEvents } from "@lichtblick/suite-base/context/EventsContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import {
  LeftSidebarItemKey,
  RightSidebarItemKey,
  SidebarItemKey,
  SidebarItemKeys,
  WorkspaceContextStore,
  useWorkspaceStore,
} from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import useAddPanel from "@lichtblick/suite-base/hooks/useAddPanel";
import { useDefaultWebLaunchPreference } from "@lichtblick/suite-base/hooks/useDefaultWebLaunchPreference";
import useElectronFilesToOpen from "@lichtblick/suite-base/hooks/useElectronFilesToOpen";
import { useHandleFiles } from "@lichtblick/suite-base/hooks/useHandleFiles";
import useSeekTimeFromCLI from "@lichtblick/suite-base/hooks/useSeekTimeFromCLI";
import { useStructureItemsStoreManager } from "@lichtblick/suite-base/panels/Plot/hooks/useStructureItemsStoreManager";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { PanelStateContextProvider } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import WorkspaceContextProvider from "@lichtblick/suite-base/providers/WorkspaceContextProvider";
import ICONS from "@lichtblick/suite-base/theme/icons";
import { InjectedSidebarItem, Namespace, WorkspaceProps } from "@lichtblick/suite-base/types";
import { parseAppURLState } from "@lichtblick/suite-base/util/appURLState";
import useBroadcast from "@lichtblick/suite-base/util/broadcast/useBroadcast";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

import { useWorkspaceActions } from "./context/Workspace/useWorkspaceActions";

const log = Logger.getLogger(__filename);

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

function isInjectedSidebarItem(
  item: [string, { iconName?: string; title: string }],
): item is InjectedSidebarItem {
  return (
    SidebarItemKeys.some((itemKey) => itemKey === item[0]) &&
    item[1].iconName != undefined &&
    Object.keys(ICONS).includes(item[1].iconName)
  );
}

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerIsPresent = ({ playerState }: MessagePipelineContext) =>
  playerState.presence !== PlayerPresence.NOT_PRESENT;
const selectPlayerAlerts = ({ playerState }: MessagePipelineContext) => playerState.alerts;
const selectIsPlaying = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.isPlaying === true;
const selectPause = (ctx: MessagePipelineContext) => ctx.pausePlayback;
const selectPlay = (ctx: MessagePipelineContext) => ctx.startPlayback;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectPlayUntil = (ctx: MessagePipelineContext) => ctx.playUntil;
const selectPlayerId = (ctx: MessagePipelineContext) => ctx.playerState.playerId;
const selectEventsSupported = (store: EventsStore) => store.eventsSupported;
const selectSelectEvent = (store: EventsStore) => store.selectEvent;

const selectWorkspaceDataSourceDialog = (store: WorkspaceContextStore) => store.dialogs.dataSource;
const selectWorkspaceLeftSidebarItem = (store: WorkspaceContextStore) => store.sidebars.left.item;
const selectWorkspaceLeftSidebarOpen = (store: WorkspaceContextStore) => store.sidebars.left.open;
const selectWorkspaceLeftSidebarSize = (store: WorkspaceContextStore) => store.sidebars.left.size;
const selectWorkspaceRightSidebarItem = (store: WorkspaceContextStore) => store.sidebars.right.item;
const selectWorkspaceRightSidebarOpen = (store: WorkspaceContextStore) => store.sidebars.right.open;
const selectWorkspaceRightSidebarSize = (store: WorkspaceContextStore) => store.sidebars.right.size;

function WorkspaceContent(props: WorkspaceProps): React.JSX.Element {
  const { PerformanceSidebarComponent } = useAppContext();
  const { classes } = useStyles();
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const { availableSources, selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerAlerts = useMessagePipeline(selectPlayerAlerts);

  const dataSourceDialog = useWorkspaceStore(selectWorkspaceDataSourceDialog);
  const leftSidebarItem = useWorkspaceStore(selectWorkspaceLeftSidebarItem);
  const leftSidebarOpen = useWorkspaceStore(selectWorkspaceLeftSidebarOpen);
  const leftSidebarSize = useWorkspaceStore(selectWorkspaceLeftSidebarSize);
  const rightSidebarItem = useWorkspaceStore(selectWorkspaceRightSidebarItem);
  const rightSidebarOpen = useWorkspaceStore(selectWorkspaceRightSidebarOpen);
  const rightSidebarSize = useWorkspaceStore(selectWorkspaceRightSidebarSize);
  const { AppBarComponent = AppBar } = props;

  const play = useMessagePipeline(selectPlay);
  const playUntil = useMessagePipeline(selectPlayUntil);
  const pause = useMessagePipeline(selectPause);
  const seek = useMessagePipeline(selectSeek);
  const isPlaying = useMessagePipeline(selectIsPlaying);
  const getMessagePipeline = useMessagePipelineGetter();
  const getTimeInfo = useCallback(
    () => getMessagePipeline().playerState.activeData ?? {},
    [getMessagePipeline],
  );

  const { dialogActions, sidebarActions } = useWorkspaceActions();
  const { handleFiles } = useHandleFiles({
    availableSources,
    selectSource,
    isPlaying,
    playerEvents: { play, pause },
  });

  // Store stable reference to avoid re-running effects unnecessarily
  const handleFilesRef = useRef<typeof handleFiles>(handleFiles);
  useLayoutEffect(() => {
    handleFilesRef.current = handleFiles;
  }, [handleFiles]);

  // file types we support for drag/drop
  const allowedDropExtensions = useMemo(() => {
    const extensions: string[] = [AllowedFileExtensions.FOXE, AllowedFileExtensions.JSON];
    for (const source of availableSources) {
      if (source.type === "file" && source.supportedFileTypes) {
        extensions.push(...source.supportedFileTypes);
      }
    }
    return extensions;
  }, [availableSources]);

  // We use playerId to detect when a player changes for RemountOnValueChange below
  // see comment below above the RemountOnValueChange component
  const playerId = useMessagePipeline(selectPlayerId);

  const currentUserType = useCurrentUserType();

  useDefaultWebLaunchPreference();

  useStructureItemsStoreManager();

  const [enableDebugMode = false] = useAppConfigurationValue<boolean>(AppSetting.SHOW_DEBUG_PANELS);

  const { currentUser, signIn } = useCurrentUser();

  const supportsAccountSettings = signIn != undefined;

  const [enableStudioLogsSidebar = false] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_DEBUG_PANELS,
  );

  // Since we can't toggle the title bar on an electron window, keep the setting at its initial
  // value until the app is reloaded/relaunched.
  const [currentEnableNewTopNav = true] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_NEW_TOPNAV,
  );

  const [initialEnableNewTopNav] = useState(currentEnableNewTopNav);
  const enableNewTopNav = isDesktopApp() ? initialEnableNewTopNav : currentEnableNewTopNav;

  const { sidebarItems: appContextSidebarItems } = useAppContext();

  // When a player is activated, hide the open dialog.
  useLayoutEffect(() => {
    if (
      playerPresence === PlayerPresence.PRESENT ||
      playerPresence === PlayerPresence.INITIALIZING
    ) {
      dialogActions.dataSource.close();
    }
  }, [dialogActions.dataSource, playerPresence]);

  useEffect(() => {
    // Focus on page load to enable keyboard interaction.
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // files the main thread told us to open
  const filesToOpen = useElectronFilesToOpen();

  useEffect(() => {
    handleFilesRef.current = handleFiles;
  }, [handleFiles]);

  useEffect(() => {
    if (filesToOpen && filesToOpen.length > 0) {
      void handleFilesRef.current(Array.from(filesToOpen));
    }
  }, [filesToOpen]);

  const dropHandler = useCallback(
    async ({
      files,
      handles,
      namespace = "local",
    }: {
      files?: File[];
      handles?: FileSystemFileHandle[];
      namespace?: Namespace;
    }) => {
      const filesArray: File[] = [];

      if (handles?.length === 1) {
        const fileHandle = handles[0];
        if (fileHandle) {
          filesArray.push(await fileHandle.getFile());
        }
      } else if (files?.length != undefined) {
        filesArray.push(...files);
      }

      void handleFiles(filesArray, namespace);
    },
    [handleFiles],
  );

  // Since the _component_ field of a sidebar item entry is a component and accepts no additional
  // props we need to wrap our DataSourceSidebar component to connect the open data source action to
  // open the data source dialog.
  const DataSourceSidebarItem = useMemo(() => {
    return function DataSourceSidebarItemImpl() {
      return <DataSourceSidebar disableToolbar={enableNewTopNav} />;
    };
  }, [enableNewTopNav]);

  const PanelSettingsSidebar = useMemo(() => {
    return function PanelSettingsSidebarImpl() {
      return <PanelSettings disableToolbar />;
    };
  }, []);

  const { layoutBrowser: AppContextLayoutBrowser } = useAppContext();

  const [sidebarItems, sidebarBottomItems] = useMemo(() => {
    const topItems = new Map<SidebarItemKey, SidebarItem>([
      [
        "connection",
        {
          iconName: "DatabaseSettings",
          title: "Data source",
          component: DataSourceSidebarItem,
          badge:
            playerAlerts && playerAlerts.length > 0 ? { count: playerAlerts.length } : undefined,
        },
      ],
    ]);

    if (!enableNewTopNav) {
      topItems.set("layouts", {
        iconName: "FiveTileGrid",
        title: "Layouts",
        component: AppContextLayoutBrowser ?? LayoutBrowser,
      });
      topItems.set("add-panel", {
        iconName: "RectangularClipping",
        title: "Add panel",
        component: AddPanel,
      });
    }
    topItems.set("panel-settings", {
      iconName: "PanelSettings",
      title: "Panel settings",
      component: PanelSettings,
    });
    if (!enableNewTopNav) {
      topItems.set("variables", {
        iconName: "Variable2",
        title: "Variables",
        component: VariablesList,
      });
      topItems.set("extensions", {
        iconName: "AddIn",
        title: "Extensions",
        component: ExtensionsSidebar,
      });
    }
    if (enableStudioLogsSidebar) {
      topItems.set("logs-settings", {
        iconName: "BacklogList",
        title: "Studio logs settings",
        component: StudioLogsSettingsSidebar,
      });
    }

    const bottomItems = new Map<SidebarItemKey, SidebarItem>([]);

    if (!enableNewTopNav) {
      if (supportsAccountSettings) {
        bottomItems.set("account", {
          iconName: currentUser != undefined ? "BlockheadFilled" : "Blockhead",
          title: currentUser != undefined ? `Signed in as ${currentUser.email}` : "Account",
          component: AccountSettings,
        });
      }

      for (const item of appContextSidebarItems ?? []) {
        if (isInjectedSidebarItem(item)) {
          bottomItems.set(item[0], item[1]);
        }
      }

      bottomItems.set("app-settings", {
        iconName: "Settings",
        title: "Settings",
      });
    }

    return [topItems, bottomItems];
  }, [
    DataSourceSidebarItem,
    playerAlerts,
    enableNewTopNav,
    enableStudioLogsSidebar,
    AppContextLayoutBrowser,
    supportsAccountSettings,
    currentUser,
    appContextSidebarItems,
  ]);

  const eventsSupported = useEvents(selectEventsSupported);
  const showEventsTab = currentUserType !== "unauthenticated" && eventsSupported;

  const leftSidebarItems = useMemo(() => {
    const items = new Map<LeftSidebarItemKey, SidebarItem>([
      ["panel-settings", { title: "Panel", component: PanelSettingsSidebar }],
      ["topics", { title: "Topics", component: TopicList }],
      [
        "alerts",
        {
          title: "Alerts",
          component: AlertsList,
          badge:
            playerAlerts && playerAlerts.length > 0
              ? {
                  count: playerAlerts.length,
                  color: "error",
                }
              : undefined,
        },
      ],
      ["layouts", { title: "Layouts", component: LayoutBrowser }],
    ]);
    return items;
  }, [PanelSettingsSidebar, playerAlerts]);

  const rightSidebarItems = useMemo(() => {
    const items = new Map<RightSidebarItemKey, SidebarItem>([
      [
        "variables",
        {
          title: t("workspace:variables"),
          component: VariablesList,
        },
      ],
    ]);
    if (enableDebugMode) {
      if (PerformanceSidebarComponent) {
        items.set("performance", {
          title: t("workspace:performance"),
          component: PerformanceSidebarComponent,
        });
      }
      items.set("logs-settings", {
        title: t("workspace:studioLogs"),
        component: StudioLogsSettings,
      });
    }
    if (showEventsTab) {
      items.set("events", {
        title: t("workspace:events"),
        component: EventsList,
      });
    }
    return items;
  }, [enableDebugMode, showEventsTab, PerformanceSidebarComponent]);

  const keyboardEventHasModifier = (event: KeyboardEvent) =>
    navigator.userAgent.includes("Mac") ? event.metaKey : event.ctrlKey;

  function AddPanel() {
    const addPanel = useAddPanel();
    const { openLayoutBrowser } = useWorkspaceActions();
    const selectedLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
    const { t: tAddPanel } = useTranslation("addPanel");

    return (
      <SidebarContent disablePadding={selectedLayoutId != undefined} title={tAddPanel("addPanel")}>
        {selectedLayoutId == undefined ? (
          <Typography color="text.secondary">
            <Trans
              t={tAddPanel}
              i18nKey="noLayoutSelected"
              components={{
                selectLayoutLink: <Link onClick={openLayoutBrowser} />,
              }}
            />
          </Typography>
        ) : (
          <PanelCatalog mode="list" onPanelSelect={addPanel} />
        )}
      </SidebarContent>
    );
  }

  function ExtensionsSidebar() {
    return (
      <SidebarContent title="Extensions" disablePadding>
        <ExtensionsSettings />
      </SidebarContent>
    );
  }

  const keyDownHandlers = useMemo(() => {
    return {
      "[": () => {
        sidebarActions.left.setOpen((oldValue) => !oldValue);
      },
      "]": () => {
        sidebarActions.right.setOpen((oldValue) => !oldValue);
      },
      o: (ev: KeyboardEvent) => {
        if (!keyboardEventHasModifier(ev)) {
          return;
        }
        ev.preventDefault();
        if (ev.shiftKey) {
          dialogActions.dataSource.open("connection");
          return;
        }
        void dialogActions.openFile.open().catch((err: unknown) => {
          console.error(err);
        });
      },
    };
  }, [dialogActions.dataSource, dialogActions.openFile, sidebarActions.left, sidebarActions.right]);

  const targetUrlState = useMemo(() => {
    const deepLinks = props.deepLinks ?? [];
    return deepLinks[0] ? parseAppURLState(new URL(deepLinks[0])) : undefined;
  }, [props.deepLinks]);

  const [unappliedSourceArgs, setUnappliedSourceArgs] = useState(
    targetUrlState ? { ds: targetUrlState.ds, dsParams: targetUrlState.dsParams } : undefined,
  );

  const selectEvent = useEvents(selectSelectEvent);
  // Load data source from URL.
  useEffect(() => {
    if (!unappliedSourceArgs) {
      return;
    }

    // Apply any available data source args
    if (unappliedSourceArgs.ds) {
      log.debug("Initialising source from url", unappliedSourceArgs);
      selectSource(unappliedSourceArgs.ds, {
        type: "connection",
        params: unappliedSourceArgs.dsParams,
      });
      selectEvent(unappliedSourceArgs.dsParams?.eventId);
      setUnappliedSourceArgs({ ds: undefined, dsParams: undefined });
    }
  }, [selectEvent, selectSource, unappliedSourceArgs, setUnappliedSourceArgs]);

  const [unappliedTime, setUnappliedTime] = useState(
    targetUrlState ? { time: targetUrlState.time } : undefined,
  );
  // Seek to time in URL.
  useEffect(() => {
    if (unappliedTime?.time == undefined || !seek) {
      return;
    }

    // Wait until player is ready before we try to seek.
    if (playerPresence !== PlayerPresence.PRESENT) {
      return;
    }

    log.debug(`Seeking to url time:`, unappliedTime.time);
    seek(unappliedTime.time);
    setUnappliedTime({ time: undefined });
  }, [playerPresence, seek, unappliedTime]);

  useSeekTimeFromCLI();

  const appBar = useMemo(
    () => (
      <AppBarComponent
        leftInset={props.appBarLeftInset}
        onDoubleClick={props.onAppBarDoubleClick}
        showCustomWindowControls={props.showCustomWindowControls}
        isMaximized={props.isMaximized}
        initialZoomFactor={props.initialZoomFactor}
        onMinimizeWindow={props.onMinimizeWindow}
        onMaximizeWindow={props.onMaximizeWindow}
        onUnmaximizeWindow={props.onUnmaximizeWindow}
        onCloseWindow={props.onCloseWindow}
      />
    ),
    [
      AppBarComponent,
      props.appBarLeftInset,
      props.isMaximized,
      props.initialZoomFactor,
      props.onAppBarDoubleClick,
      props.onCloseWindow,
      props.onMaximizeWindow,
      props.onMinimizeWindow,
      props.onUnmaximizeWindow,
      props.showCustomWindowControls,
    ],
  );

  useBroadcast({
    play,
    pause,
    seek,
    playUntil,
  });

  return (
    <PanelStateContextProvider>
      {dataSourceDialog.open && <DataSourceDialog />}
      <DocumentDropListener onDrop={dropHandler} allowedExtensions={allowedDropExtensions} />
      <SyncAdapters />
      <KeyListener global keyDownHandlers={keyDownHandlers} />
      <div className={classes.container} ref={containerRef} tabIndex={0}>
        {appBar}
        <Sidebars
          selectedKey=""
          onSelectKey={() => {}}
          items={sidebarItems}
          leftItems={leftSidebarItems}
          bottomItems={sidebarBottomItems}
          selectedLeftKey={leftSidebarOpen ? leftSidebarItem : undefined}
          onSelectLeftKey={sidebarActions.left.selectItem}
          leftSidebarSize={leftSidebarSize}
          setLeftSidebarSize={sidebarActions.left.setSize}
          rightItems={rightSidebarItems}
          selectedRightKey={rightSidebarOpen ? rightSidebarItem : undefined}
          onSelectRightKey={sidebarActions.right.selectItem}
          rightSidebarSize={rightSidebarSize}
          setRightSidebarSize={sidebarActions.right.setSize}
        >
          {/* To ensure no stale player state remains, we unmount all panels when players change */}
          <RemountOnValueChange value={playerId}>
            <Stack>
              <PanelLayout />
            </Stack>
          </RemountOnValueChange>
        </Sidebars>
        {play && pause && seek && (
          <div style={{ flexShrink: 0 }}>
            <PlaybackControls
              play={play}
              pause={pause}
              seek={seek}
              playUntil={playUntil}
              isPlaying={isPlaying}
              getTimeInfo={getTimeInfo}
            />
          </div>
        )}
      </div>
      <WorkspaceDialogs />
    </PanelStateContextProvider>
  );
}

export default function Workspace(props: WorkspaceProps): React.JSX.Element {
  const [showOpenDialogOnStartup = true] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );

  const { workspaceStoreCreator } = useAppContext();

  const isPlayerPresent = useMessagePipeline(selectPlayerIsPresent);

  const initialItem: undefined | DataSourceDialogItem =
    isPlayerPresent || !showOpenDialogOnStartup ? undefined : "start";

  const initialState: Pick<WorkspaceContextStore, "dialogs"> = {
    dialogs: {
      dataSource: {
        activeDataSource: undefined,
        open: initialItem != undefined,
        item: initialItem,
      },
      preferences: {
        initialTab: undefined,
        open: false,
      },
    },
  };

  return (
    <WorkspaceContextProvider
      initialState={initialState}
      workspaceStoreCreator={workspaceStoreCreator}
      disablePersistenceForStorybook={props.disablePersistenceForStorybook}
    >
      <WorkspaceContent {...props} />
    </WorkspaceContextProvider>
  );
}
