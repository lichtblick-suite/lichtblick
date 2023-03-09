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
import { useSnackbar } from "notistack";
import { extname } from "path";
import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { makeStyles } from "tss-react/mui";

import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AccountSettings from "@foxglove/studio-base/components/AccountSettingsSidebar/AccountSettings";
import { AppBar } from "@foxglove/studio-base/components/AppBar";
import { CustomWindowControlsProps } from "@foxglove/studio-base/components/AppBar/CustomWindowControls";
import { DataSourceSidebar } from "@foxglove/studio-base/components/DataSourceSidebar";
import { EventsList } from "@foxglove/studio-base/components/DataSourceSidebar/EventsList";
import { TopicList } from "@foxglove/studio-base/components/DataSourceSidebar/TopicList";
import DocumentDropListener from "@foxglove/studio-base/components/DocumentDropListener";
import ExtensionsSettings from "@foxglove/studio-base/components/ExtensionsSettings";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import LayoutBrowser from "@foxglove/studio-base/components/LayoutBrowser";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import { OpenDialog, OpenDialogViews } from "@foxglove/studio-base/components/OpenDialog";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import PanelList from "@foxglove/studio-base/components/PanelList";
import PanelSettings from "@foxglove/studio-base/components/PanelSettings";
import PlaybackControls from "@foxglove/studio-base/components/PlaybackControls";
import Preferences from "@foxglove/studio-base/components/Preferences";
import RemountOnValueChange from "@foxglove/studio-base/components/RemountOnValueChange";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Sidebars, { SidebarItem } from "@foxglove/studio-base/components/Sidebars";
import { NewSidebarItem } from "@foxglove/studio-base/components/Sidebars/NewSidebar";
import { SignInFormModal } from "@foxglove/studio-base/components/SignInFormModal";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  StudioLogsSettings,
  StudioLogsSettingsSidebar,
} from "@foxglove/studio-base/components/StudioLogsSettings";
import { SyncAdapters } from "@foxglove/studio-base/components/SyncAdapters";
import VariablesList from "@foxglove/studio-base/components/VariablesList";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { useAssets } from "@foxglove/studio-base/context/AssetsContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { useNativeAppMenu } from "@foxglove/studio-base/context/NativeAppMenuContext";
import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useWorkspace, WorkspaceContext } from "@foxglove/studio-base/context/WorkspaceContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import useAddPanel from "@foxglove/studio-base/hooks/useAddPanel";
import { useCalloutDismissalBlocker } from "@foxglove/studio-base/hooks/useCalloutDismissalBlocker";
import { useDefaultWebLaunchPreference } from "@foxglove/studio-base/hooks/useDefaultWebLaunchPreference";
import useElectronFilesToOpen from "@foxglove/studio-base/hooks/useElectronFilesToOpen";
import { useInitialDeepLinkState } from "@foxglove/studio-base/hooks/useInitialDeepLinkState";
import useNativeAppMenuEvent from "@foxglove/studio-base/hooks/useNativeAppMenuEvent";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { PanelStateContextProvider } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const log = Logger.getLogger(__filename);

const useStyles = makeStyles()({
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: "1 1 100%",
    outline: "none",
    overflow: "hidden",
  },
});

type SidebarItemKey =
  | "connection"
  | "add-panel"
  | "panel-settings"
  | "variables"
  | "extensions"
  | "account"
  | "layouts"
  | "preferences"
  | "help"
  | "studio-logs-settings";

type LeftSidebarItemKey = "topics" | "variables" | "studio-logs-settings";
type RightSidebarItemKey = "panel-settings" | "events";

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

function activeElementIsInput() {
  return (
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement
  );
}

function keyboardEventHasModifier(event: KeyboardEvent) {
  if (navigator.userAgent.includes("Mac")) {
    return event.metaKey;
  } else {
    return event.ctrlKey;
  }
}

function AddPanel() {
  const addPanel = useAddPanel();
  const { openLayoutBrowser } = useWorkspace();
  const selectedLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);

  return (
    <SidebarContent disablePadding={selectedLayoutId != undefined} title="Add panel">
      {selectedLayoutId == undefined ? (
        <Typography color="text.secondary">
          <Link onClick={openLayoutBrowser}>Select a layout</Link> to get started!
        </Typography>
      ) : (
        <PanelList onPanelSelect={addPanel} />
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

type WorkspaceProps = CustomWindowControlsProps & {
  deepLinks?: string[];
  appBarLeftInset?: number;
  onAppBarDoubleClick?: () => void;
};

const DEFAULT_DEEPLINKS = Object.freeze([]);

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;
const selectIsPlaying = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.isPlaying === true;
const selectPause = (ctx: MessagePipelineContext) => ctx.pausePlayback;
const selectPlay = (ctx: MessagePipelineContext) => ctx.startPlayback;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectPlayUntil = (ctx: MessagePipelineContext) => ctx.playUntil;
const selectPlayerId = (ctx: MessagePipelineContext) => ctx.playerState.playerId;
const selectPlayerSourceId = ({ playerState }: MessagePipelineContext) =>
  playerState.urlState?.sourceId;

export default function Workspace(props: WorkspaceProps): JSX.Element {
  const { classes } = useStyles();
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const { availableSources, selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerProblems = useMessagePipeline(selectPlayerProblems);

  const [prefsDialogOpen, setPrefsDialogOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);

  // file types we support for drag/drop
  const allowedDropExtensions = useMemo(() => {
    const extensions = [".foxe", ".urdf", ".xacro"];
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
  const playerSourceId = useMessagePipeline(selectPlayerSourceId);

  const isPlayerPresent = playerPresence !== PlayerPresence.NOT_PRESENT;

  const { currentUser, signIn } = useCurrentUser();
  const supportsAccountSettings = signIn != undefined;

  const { currentUserRequired } = useInitialDeepLinkState(props.deepLinks ?? DEFAULT_DEEPLINKS);

  useDefaultWebLaunchPreference();

  const [showOpenDialogOnStartup = true] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );
  const [enableStudioLogsSidebar = false] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_DEBUG_PANELS,
  );
  // Since we can't toggle the title bar on an electron window, keep the setting at its initial
  // value until the app is reloaded/relaunched.
  const [currentEnableNewTopNav = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_NEW_TOPNAV,
  );

  const [initialEnableNewTopNav] = useState(currentEnableNewTopNav);
  const enableNewTopNav = isDesktopApp() ? initialEnableNewTopNav : currentEnableNewTopNav;

  const showSignInForm = currentUserRequired && currentUser == undefined;

  const [showOpenDialog, setShowOpenDialog] = useState<
    { view: OpenDialogViews; activeDataSource?: IDataSourceFactory } | undefined
  >(isPlayerPresent || !showOpenDialogOnStartup || showSignInForm ? undefined : { view: "start" });

  const [selectedSidebarItem, setSelectedSidebarItem] = useState<SidebarItemKey | undefined>(
    "connection",
  );

  const [selectedLeftSidebarItem, setSelectedLeftSidebarItem] = useState<
    LeftSidebarItemKey | undefined
  >("topics");
  const [selectedRightSidebarItem, setSelectedRightSidebarItem] = useState<
    RightSidebarItemKey | undefined
  >(undefined);

  // When a player is present we hide the connection sidebar. To prevent hiding the connection sidebar
  // when the user wants to select a new connection we track whether the sidebar item opened
  const userSelectSidebarItem = useRef(false);

  const selectSidebarItem = useCallback((item: SidebarItemKey | undefined) => {
    userSelectSidebarItem.current = true;
    setSelectedSidebarItem(item);
  }, []);

  // When a player is activated, hide the open dialog.
  useLayoutEffect(() => {
    if (
      playerPresence === PlayerPresence.PRESENT ||
      playerPresence === PlayerPresence.INITIALIZING
    ) {
      setShowOpenDialog(undefined);
    }
  }, [playerPresence]);

  useEffect(() => {
    // Focus on page load to enable keyboard interaction.
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  useCalloutDismissalBlocker();

  useNativeAppMenuEvent(
    "open-layouts",
    useCallback(() => {
      setSelectedSidebarItem("layouts");
    }, []),
  );

  useNativeAppMenuEvent(
    "open-add-panel",
    useCallback(() => {
      setSelectedSidebarItem("add-panel");
    }, []),
  );

  useNativeAppMenuEvent(
    "open-panel-settings",
    useCallback(() => {
      setSelectedSidebarItem("panel-settings");
    }, []),
  );

  useNativeAppMenuEvent(
    "open-variables",
    useCallback(() => {
      setSelectedSidebarItem("variables");
    }, []),
  );

  useNativeAppMenuEvent(
    "open-extensions",
    useCallback(() => {
      setSelectedSidebarItem("extensions");
    }, []),
  );

  useNativeAppMenuEvent(
    "open-account",
    useCallback(() => {
      setSelectedSidebarItem("account");
    }, []),
  );

  useNativeAppMenuEvent(
    "open-preferences",
    useCallback(() => {
      if (enableNewTopNav) {
        setPrefsDialogOpen(true);
      } else {
        setSelectedSidebarItem("preferences");
      }
    }, [enableNewTopNav]),
  );

  useNativeAppMenuEvent(
    "open-file",
    useCallback(() => {
      setShowOpenDialog({ view: "file" });
    }, []),
  );

  useNativeAppMenuEvent(
    "open-remote-file",
    useCallback(() => {
      setShowOpenDialog({ view: "remote" });
    }, []),
  );

  useNativeAppMenuEvent(
    "open-sample-data",
    useCallback(() => {
      setShowOpenDialog({ view: "demo" });
    }, []),
  );

  const nativeAppMenu = useNativeAppMenu();

  const connectionSources = useMemo(() => {
    return availableSources.filter((source) => source.type === "connection");
  }, [availableSources]);

  useEffect(() => {
    if (!nativeAppMenu) {
      return;
    }

    for (const item of connectionSources) {
      nativeAppMenu.addFileEntry(item.displayName, () => {
        setShowOpenDialog({ view: "connection", activeDataSource: item });
      });
    }

    return () => {
      for (const item of connectionSources) {
        nativeAppMenu.removeFileEntry(item.displayName);
      }
    };
  }, [connectionSources, nativeAppMenu, selectSource]);

  const { enqueueSnackbar } = useSnackbar();

  const { loadFromFile } = useAssets();
  const analytics = useAnalytics();

  const installExtension = useExtensionCatalog((state) => state.installExtension);

  const openHandle = useCallback(
    async (
      handle: FileSystemFileHandle /* foxglove-depcheck-used: @types/wicg-file-system-access */,
    ) => {
      log.debug("open handle", handle);
      const file = await handle.getFile();
      // electron extends File with a `path` field which is not available in browsers
      const basePath = (file as { path?: string }).path ?? "";

      if (file.name.endsWith(".foxe")) {
        // Extension installation
        try {
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);
          const extension = await installExtension("local", data);
          enqueueSnackbar(`Installed extension ${extension.id}`, { variant: "success" });
        } catch (err) {
          log.error(err);
          enqueueSnackbar(`Failed to install extension ${file.name}: ${err.message}`, {
            variant: "error",
          });
        }
      } else {
        try {
          if (await loadFromFile(file, { basePath, analytics, source: "local_file" })) {
            return;
          }
        } catch (err) {
          log.error(err);
          enqueueSnackbar(`Failed to load ${file.name}: ${err.message}`, { variant: "error" });
        }
      }

      // Look for a source that supports the file extensions
      const matchedSource = availableSources.find((source) => {
        const ext = extname(file.name);
        return source.supportedFileTypes?.includes(ext);
      });
      if (matchedSource) {
        selectSource(matchedSource.id, { type: "file", handle });
      }
    },
    [analytics, availableSources, enqueueSnackbar, installExtension, loadFromFile, selectSource],
  );

  const openFiles = useCallback(
    async (files: File[]) => {
      const otherFiles: File[] = [];
      log.debug("open files", files);

      for (const file of files) {
        // electron extends File with a `path` field which is not available in browsers
        const basePath = (file as { path?: string }).path ?? "";

        if (file.name.endsWith(".foxe")) {
          // Extension installation
          try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const extension = await installExtension("local", data);
            enqueueSnackbar(`Installed extension ${extension.id}`, { variant: "success" });
          } catch (err) {
            log.error(err);
            enqueueSnackbar(`Failed to install extension ${file.name}: ${err.message}`, {
              variant: "error",
            });
          }
        } else {
          try {
            if (!(await loadFromFile(file, { basePath, analytics, source: "local_file" }))) {
              otherFiles.push(file);
            }
          } catch (err) {
            log.error(err);
            enqueueSnackbar(`Failed to load ${file.name}: ${err.message}`, { variant: "error" });
          }
        }
      }

      if (otherFiles.length > 0) {
        // Look for a source that supports the dragged file extensions
        for (const source of availableSources) {
          const filteredFiles = otherFiles.filter((file) => {
            const ext = extname(file.name);
            return source.supportedFileTypes?.includes(ext);
          });

          // select the first source that has files that match the supported extensions
          if (filteredFiles.length > 0) {
            selectSource(source.id, { type: "file", files: otherFiles });
            break;
          }
        }
      }
    },
    [analytics, availableSources, enqueueSnackbar, installExtension, loadFromFile, selectSource],
  );

  // files the main thread told us to open
  const filesToOpen = useElectronFilesToOpen();
  useEffect(() => {
    if (filesToOpen) {
      void openFiles(Array.from(filesToOpen));
    }
  }, [filesToOpen, openFiles]);

  const dropHandler = useCallback(
    (event: { files?: File[]; handles?: FileSystemFileHandle[] }) => {
      const handle = event.handles?.[0];
      // When selecting sources with handles we can only select with a single handle since we haven't
      // written the code to store multiple handles for recents. When there are multiple handles, we
      // fall back to opening regular files.
      if (handle && event.handles?.length === 1) {
        void openHandle(handle);
      } else if (event.files) {
        void openFiles(event.files);
      }
    },
    [openFiles, openHandle],
  );

  const workspaceContextValue = useMemo(
    () => ({
      panelSettingsOpen:
        selectedSidebarItem === "panel-settings" || selectedRightSidebarItem === "panel-settings",
      openPanelSettings: () =>
        enableNewTopNav
          ? setSelectedRightSidebarItem("panel-settings")
          : setSelectedSidebarItem("panel-settings"),
      // ↓ ↓ ↓  just remove this one when deleting enableNewTopNav feature flag  ↓ ↓ ↓
      openAccountSettings: () => supportsAccountSettings && setSelectedSidebarItem("account"),
      openLayoutBrowser: () =>
        enableNewTopNav ? setLayoutMenuOpen(true) : setSelectedSidebarItem("layouts"),
      leftSidebarOpen: selectedLeftSidebarItem != undefined,
      // eslint-disable-next-line @foxglove/no-boolean-parameters
      setLeftSidebarOpen: (open: boolean) =>
        setSelectedLeftSidebarItem(open ? "topics" : undefined),
      rightSidebarOpen: selectedRightSidebarItem != undefined,
      // eslint-disable-next-line @foxglove/no-boolean-parameters
      setRightSidebarOpen: (open: boolean) =>
        setSelectedRightSidebarItem(open ? "panel-settings" : undefined),
    }),
    [
      selectedSidebarItem,
      selectedLeftSidebarItem,
      selectedRightSidebarItem,
      enableNewTopNav,
      supportsAccountSettings,
    ],
  );

  // Since the _component_ field of a sidebar item entry is a component and accepts no additional
  // props we need to wrap our DataSourceSidebar component to connect the open data source action to
  // open the data source dialog.
  const DataSourceSidebarItem = useMemo(() => {
    return function DataSourceSidebarItemImpl() {
      return (
        <DataSourceSidebar
          disableToolbar={enableNewTopNav}
          onSelectDataSourceAction={() => setShowOpenDialog({ view: "start" })}
        />
      );
    };
  }, [enableNewTopNav]);

  const PanelSettingsSidebar = useMemo(() => {
    return function PanelSettingsSidebarImpl() {
      return <PanelSettings disableToolbar />;
    };
  }, []);

  const ConnectedLayoutBrowser = useCallback(
    () => <LayoutBrowser supportsSignIn={supportsAccountSettings} />,
    [supportsAccountSettings],
  );

  const [sidebarItems, sidebarBottomItems] = useMemo(() => {
    const topItems = new Map<SidebarItemKey, SidebarItem>([
      [
        "connection",
        {
          iconName: "DatabaseSettings",
          title: "Data source",
          component: DataSourceSidebarItem,
          badge:
            playerProblems && playerProblems.length > 0
              ? { count: playerProblems.length }
              : undefined,
        },
      ],
    ]);

    if (!enableNewTopNav) {
      topItems.set("layouts", {
        iconName: "FiveTileGrid",
        title: "Layouts",
        component: ConnectedLayoutBrowser,
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
      topItems.set("studio-logs-settings", {
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

      bottomItems.set("preferences", {
        iconName: "Settings",
        title: "Preferences",
        component: Preferences,
      });
    }

    return [topItems, bottomItems];
  }, [
    DataSourceSidebarItem,
    playerProblems,
    ConnectedLayoutBrowser,
    enableStudioLogsSidebar,
    enableNewTopNav,
    supportsAccountSettings,
    currentUser,
  ]);

  const showEventsTab = currentUser != undefined && playerSourceId === "foxglove-data-platform";

  const leftSidebarItems = useMemo(() => {
    const items = new Map<LeftSidebarItemKey, NewSidebarItem>([
      ["topics", { title: "Topics", component: TopicList }],
      ["variables", { title: "Variables", component: VariablesList }],
    ]);
    if (enableStudioLogsSidebar) {
      items.set("studio-logs-settings", { title: "Studio Logs", component: StudioLogsSettings });
    }
    return items;
  }, [enableStudioLogsSidebar]);

  const rightSidebarItems = useMemo(() => {
    const items = new Map<RightSidebarItemKey, NewSidebarItem>([
      ["panel-settings", { title: "Panel settings", component: PanelSettingsSidebar }],
    ]);
    if (showEventsTab) {
      items.set("events", { title: "Events", component: EventsList });
    }
    return items;
  }, [PanelSettingsSidebar, showEventsTab]);

  const keyDownHandlers = useMemo(() => {
    const { leftSidebarOpen, rightSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen } =
      workspaceContextValue;
    return {
      b: (ev: KeyboardEvent) => {
        if (
          !keyboardEventHasModifier(ev) ||
          activeElementIsInput() ||
          selectedSidebarItem == undefined
        ) {
          return;
        }

        ev.preventDefault();
        setSelectedSidebarItem(undefined);
      },
      "[": () => setLeftSidebarOpen(!leftSidebarOpen),
      "]": () => setRightSidebarOpen(!rightSidebarOpen),
    };
  }, [selectedSidebarItem, workspaceContextValue]);

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

  return (
    <MultiProvider
      providers={[
        /* eslint-disable react/jsx-key */
        <WorkspaceContext.Provider value={workspaceContextValue} />,
        <PanelStateContextProvider />,
        /* eslint-enable react/jsx-key */
      ]}
    >
      {showSignInForm && <SignInFormModal />}
      {showOpenDialog != undefined && (
        <OpenDialog
          activeView={showOpenDialog.view}
          activeDataSource={showOpenDialog.activeDataSource}
          onDismiss={() => setShowOpenDialog(undefined)}
        />
      )}
      <DocumentDropListener onDrop={dropHandler} allowedExtensions={allowedDropExtensions} />
      <SyncAdapters />
      <KeyListener global keyDownHandlers={keyDownHandlers} />
      <div className={classes.container} ref={containerRef} tabIndex={0}>
        {enableNewTopNav && (
          <AppBar
            currentUser={currentUser}
            signIn={signIn}
            leftInset={props.appBarLeftInset}
            onDoubleClick={props.onAppBarDoubleClick}
            showCustomWindowControls={props.showCustomWindowControls}
            isMaximized={props.isMaximized}
            onMinimizeWindow={props.onMinimizeWindow}
            onMaximizeWindow={props.onMaximizeWindow}
            onUnmaximizeWindow={props.onUnmaximizeWindow}
            onCloseWindow={props.onCloseWindow}
            onSelectDataSourceAction={() => setShowOpenDialog({ view: "start" })}
            prefsDialogOpen={prefsDialogOpen}
            setPrefsDialogOpen={setPrefsDialogOpen}
            layoutMenuOpen={layoutMenuOpen}
            setLayoutMenuOpen={setLayoutMenuOpen}
          />
        )}
        <Sidebars
          items={sidebarItems}
          bottomItems={sidebarBottomItems}
          selectedKey={selectedSidebarItem}
          onSelectKey={selectSidebarItem}
          leftItems={leftSidebarItems}
          selectedLeftKey={selectedLeftSidebarItem}
          onSelectLeftKey={setSelectedLeftSidebarItem}
          rightItems={rightSidebarItems}
          selectedRightKey={selectedRightSidebarItem}
          onSelectRightKey={setSelectedRightSidebarItem}
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
    </MultiProvider>
  );
}
