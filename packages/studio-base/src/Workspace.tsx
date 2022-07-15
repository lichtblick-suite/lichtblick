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

import { Box, Link, Typography, useTheme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { extname } from "path";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
  useContext,
} from "react";
import { useToasts } from "react-toast-notifications";

import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AccountSettings from "@foxglove/studio-base/components/AccountSettingsSidebar/AccountSettings";
import { DataSourceSidebar } from "@foxglove/studio-base/components/DataSourceSidebar";
import DocumentDropListener from "@foxglove/studio-base/components/DocumentDropListener";
import DropOverlay from "@foxglove/studio-base/components/DropOverlay";
import ExtensionsSidebar from "@foxglove/studio-base/components/ExtensionsSidebar";
import GlobalVariablesTable from "@foxglove/studio-base/components/GlobalVariablesTable";
import variablesHelpContent from "@foxglove/studio-base/components/GlobalVariablesTable/index.help.md";
import HelpSidebar, {
  MESSAGE_PATH_SYNTAX_HELP_INFO,
} from "@foxglove/studio-base/components/HelpSidebar";
import LayoutBrowser from "@foxglove/studio-base/components/LayoutBrowser";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import { OpenDialog, OpenDialogViews } from "@foxglove/studio-base/components/OpenDialog";
import { OrgExtensionRegistrySyncAdapter } from "@foxglove/studio-base/components/OrgExtensionRegistrySyncAdapter";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import PanelList from "@foxglove/studio-base/components/PanelList";
import panelsHelpContent from "@foxglove/studio-base/components/PanelList/index.help.md";
import PanelSettings from "@foxglove/studio-base/components/PanelSettings";
import PlaybackControls from "@foxglove/studio-base/components/PlaybackControls";
import Preferences from "@foxglove/studio-base/components/Preferences";
import RemountOnValueChange from "@foxglove/studio-base/components/RemountOnValueChange";
import Sidebar, { SidebarItem } from "@foxglove/studio-base/components/Sidebar";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { SignInFormModal } from "@foxglove/studio-base/components/SignInFormModal";
import Stack from "@foxglove/studio-base/components/Stack";
import { URLStateSyncAdapter } from "@foxglove/studio-base/components/URLStateSyncAdapter";
import { useAssets } from "@foxglove/studio-base/context/AssetsContext";
import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useExtensionRegistry } from "@foxglove/studio-base/context/ExtensionRegistryContext";
import LinkHandlerContext from "@foxglove/studio-base/context/LinkHandlerContext";
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
import { HelpInfoStore, useHelpInfo } from "@foxglove/studio-base/providers/HelpInfoProvider";
import { PanelSettingsEditorContextProvider } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";

const log = Logger.getLogger(__filename);

const useStyles = makeStyles({
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
  dropzone: {
    fontSize: "4em",
    marginBottom: "1em",
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
  | "help";

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

function AddPanel() {
  const addPanel = useAddPanel();
  const { openLayoutBrowser } = useWorkspace();
  const theme = useTheme();
  const selectedLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);

  return (
    <SidebarContent
      disablePadding={selectedLayoutId != undefined}
      title="Add panel"
      helpContent={panelsHelpContent}
    >
      {selectedLayoutId == undefined ? (
        <Typography color="text.secondary">
          <Link onClick={openLayoutBrowser}>Select a layout</Link> to get started!
        </Typography>
      ) : (
        <PanelList onPanelSelect={addPanel} backgroundColor={theme.palette.background.default} />
      )}
    </SidebarContent>
  );
}

function Variables() {
  return (
    <SidebarContent title="Variables" helpContent={variablesHelpContent}>
      <GlobalVariablesTable />
    </SidebarContent>
  );
}

type WorkspaceProps = {
  deepLinks?: string[];
};

const DEFAULT_DEEPLINKS = Object.freeze([]);

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectRequestBackfill = ({ requestBackfill }: MessagePipelineContext) => requestBackfill;
const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;
const selectIsPlaying = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.isPlaying === true;
const selectPause = (ctx: MessagePipelineContext) => ctx.pausePlayback;
const selectPlay = (ctx: MessagePipelineContext) => ctx.startPlayback;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;

const selectSetHelpInfo = (store: HelpInfoStore) => store.setHelpInfo;

export default function Workspace(props: WorkspaceProps): JSX.Element {
  const classes = useStyles();
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const { availableSources, selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerProblems = useMessagePipeline(selectPlayerProblems);

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

  const supportsAccountSettings = useContext(ConsoleApiContext) != undefined;

  // we use requestBackfill to signal when a player changes for RemountOnValueChange below
  // see comment below above the RemountOnValueChange component
  const requestBackfill = useMessagePipeline(selectRequestBackfill);

  const isPlayerPresent = playerPresence !== PlayerPresence.NOT_PRESENT;

  const { currentUser } = useCurrentUser();

  const { currentUserRequired } = useInitialDeepLinkState(props.deepLinks ?? DEFAULT_DEEPLINKS);

  useDefaultWebLaunchPreference();

  const [showOpenDialogOnStartup = true] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );

  const showSignInForm = currentUserRequired && currentUser == undefined;

  const [showOpenDialog, setShowOpenDialog] = useState<
    { view: OpenDialogViews; activeDataSource?: IDataSourceFactory } | undefined
  >(isPlayerPresent || !showOpenDialogOnStartup || showSignInForm ? undefined : { view: "start" });

  const [selectedSidebarItem, setSelectedSidebarItem] = useState<SidebarItemKey | undefined>(
    "connection",
  );

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

  const setHelpInfo = useHelpInfo(selectSetHelpInfo);

  const handleInternalLink = useCallback(
    (event: React.MouseEvent, href: string) => {
      if (href === "#help:message-path-syntax") {
        event.preventDefault();
        setSelectedSidebarItem("help");
        setHelpInfo(MESSAGE_PATH_SYNTAX_HELP_INFO);
      }
    },
    [setHelpInfo],
  );

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
      setSelectedSidebarItem("preferences");
    }, []),
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

  const { addToast } = useToasts();

  const { loadFromFile } = useAssets();

  const installExtension = useExtensionRegistry((state) => state.installExtension);

  const openHandle = useCallback(
    async (handle: FileSystemFileHandle) => {
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
          addToast(`Installed extension ${extension.id}`, {
            appearance: "success",
            autoDismiss: true,
          });
        } catch (err) {
          log.error(err);
          addToast(`Failed to install extension ${file.name}: ${err.message}`, {
            appearance: "error",
          });
        }
      } else {
        try {
          if (await loadFromFile(file, { basePath })) {
            return;
          }
        } catch (err) {
          log.error(err);
          addToast(`Failed to load ${file.name}: ${err.message}`, {
            appearance: "error",
          });
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
    [addToast, availableSources, installExtension, loadFromFile, selectSource],
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
            addToast(`Installed extension ${extension.id}`, {
              appearance: "success",
              autoDismiss: true,
            });
          } catch (err) {
            log.error(err);
            addToast(`Failed to install extension ${file.name}: ${err.message}`, {
              appearance: "error",
            });
          }
        } else {
          try {
            if (!(await loadFromFile(file, { basePath }))) {
              otherFiles.push(file);
            }
          } catch (err) {
            log.error(err);
            addToast(`Failed to load ${file.name}: ${err.message}`, {
              appearance: "error",
            });
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
    [addToast, availableSources, installExtension, loadFromFile, selectSource],
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

  const workspaceActions = useMemo(
    () => ({
      panelSettingsOpen: selectedSidebarItem === "panel-settings",
      openPanelSettings: () => setSelectedSidebarItem("panel-settings"),
      openHelp: () => setSelectedSidebarItem("help"),
      openAccountSettings: () => supportsAccountSettings && setSelectedSidebarItem("account"),
      openLayoutBrowser: () => setSelectedSidebarItem("layouts"),
    }),
    [selectedSidebarItem, supportsAccountSettings],
  );

  // Since the _component_ field of a sidebar item entry is a component and accepts no additional
  // props we need to wrap our DataSourceSidebar component to connect the open data source action to
  // open the data source dialog.
  const DataSourceSidebarItem = useMemo(() => {
    return function DataSourceSidebarItemImpl() {
      return (
        <DataSourceSidebar onSelectDataSourceAction={() => setShowOpenDialog({ view: "start" })} />
      );
    };
  }, []);

  const sidebarItems = useMemo<Map<SidebarItemKey, SidebarItem>>(() => {
    const SIDEBAR_ITEMS = new Map<SidebarItemKey, SidebarItem>([
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
      ["layouts", { iconName: "FiveTileGrid", title: "Layouts", component: LayoutBrowser }],
      ["add-panel", { iconName: "RectangularClipping", title: "Add panel", component: AddPanel }],
      [
        "panel-settings",
        { iconName: "PanelSettings", title: "Panel settings", component: PanelSettings },
      ],
      ["variables", { iconName: "Variable2", title: "Variables", component: Variables }],
      ["preferences", { iconName: "Settings", title: "Preferences", component: Preferences }],
      ["extensions", { iconName: "AddIn", title: "Extensions", component: ExtensionsSidebar }],
      ["help", { iconName: "QuestionCircle", title: "Help", component: HelpSidebar }],
    ]);

    return supportsAccountSettings
      ? new Map([
          ...SIDEBAR_ITEMS,
          [
            "account",
            {
              iconName: currentUser != undefined ? "BlockheadFilled" : "Blockhead",
              title: currentUser != undefined ? `Signed in as ${currentUser.email}` : "Account",
              component: AccountSettings,
            },
          ],
        ])
      : SIDEBAR_ITEMS;
  }, [DataSourceSidebarItem, playerProblems, supportsAccountSettings, currentUser]);

  const sidebarBottomItems: readonly SidebarItemKey[] = useMemo(() => {
    return supportsAccountSettings ? ["help", "account", "preferences"] : ["help", "preferences"];
  }, [supportsAccountSettings]);

  const play = useMessagePipeline(selectPlay);
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
        <LinkHandlerContext.Provider value={handleInternalLink} />,
        <WorkspaceContext.Provider value={workspaceActions} />,
        <PanelSettingsEditorContextProvider />,
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
      <DocumentDropListener onDrop={dropHandler} allowedExtensions={allowedDropExtensions}>
        <DropOverlay>
          <div className={classes.dropzone}>Drop a file here</div>
        </DropOverlay>
      </DocumentDropListener>
      <OrgExtensionRegistrySyncAdapter />
      <URLStateSyncAdapter />
      <div className={classes.container} ref={containerRef} tabIndex={0}>
        <Sidebar
          items={sidebarItems}
          bottomItems={sidebarBottomItems}
          selectedKey={selectedSidebarItem}
          onSelectKey={selectSidebarItem}
        >
          {/* To ensure no stale player state remains, we unmount all panels when players change */}
          <RemountOnValueChange value={requestBackfill}>
            <Stack>
              <PanelLayout />
              {play && pause && seek && (
                <Box flexShrink={0}>
                  <PlaybackControls
                    play={play}
                    pause={pause}
                    seek={seek}
                    isPlaying={isPlaying}
                    getTimeInfo={getTimeInfo}
                  />
                </Box>
              )}
            </Stack>
          </RemountOnValueChange>
        </Sidebar>
      </div>
    </MultiProvider>
  );
}
