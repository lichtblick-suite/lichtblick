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

import { makeStyles, Stack } from "@fluentui/react";
import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { useToasts } from "react-toast-notifications";
import { useMount, useMountedState } from "react-use";

import Log from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AccountSettings from "@foxglove/studio-base/components/AccountSettingsSidebar/AccountSettings";
import ConnectionList from "@foxglove/studio-base/components/ConnectionList";
import DocumentDropListener from "@foxglove/studio-base/components/DocumentDropListener";
import DropOverlay from "@foxglove/studio-base/components/DropOverlay";
import ExtensionsSidebar from "@foxglove/studio-base/components/ExtensionsSidebar";
import GlobalVariablesTable from "@foxglove/studio-base/components/GlobalVariablesTable";
import variablesHelp from "@foxglove/studio-base/components/GlobalVariablesTable/index.help.md";
import HelpModal from "@foxglove/studio-base/components/HelpModal";
import LayoutBrowser from "@foxglove/studio-base/components/LayoutBrowser";
import messagePathHelp from "@foxglove/studio-base/components/MessagePathSyntax/index.help.md";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import PanelList from "@foxglove/studio-base/components/PanelList";
import PanelSettings from "@foxglove/studio-base/components/PanelSettings";
import PlaybackControls from "@foxglove/studio-base/components/PlaybackControls";
import Preferences from "@foxglove/studio-base/components/Preferences";
import RemountOnValueChange from "@foxglove/studio-base/components/RemountOnValueChange";
import ShortcutsModal from "@foxglove/studio-base/components/ShortcutsModal";
import Sidebar, { SidebarItem } from "@foxglove/studio-base/components/Sidebar";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useAppConfiguration } from "@foxglove/studio-base/context/AppConfigurationContext";
import { useAssets } from "@foxglove/studio-base/context/AssetsContext";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useExtensionLoader } from "@foxglove/studio-base/context/ExtensionLoaderContext";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import LinkHandlerContext from "@foxglove/studio-base/context/LinkHandlerContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { WorkspaceContext } from "@foxglove/studio-base/context/WorkspaceContext";
import useAddPanel from "@foxglove/studio-base/hooks/useAddPanel";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import useElectronFilesToOpen from "@foxglove/studio-base/hooks/useElectronFilesToOpen";
import useNativeAppMenuEvent from "@foxglove/studio-base/hooks/useNativeAppMenuEvent";
import welcomeLayout from "@foxglove/studio-base/layouts/welcomeLayout";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

const log = Log.getLogger(__filename);

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
  | "preferences";

function Connection() {
  return (
    <SidebarContent title="Connection">
      <ConnectionList />
    </SidebarContent>
  );
}

function AddPanel() {
  const addPanel = useAddPanel();

  return (
    <SidebarContent noPadding title="Add panel">
      <PanelList onPanelSelect={addPanel} />
    </SidebarContent>
  );
}

function Variables() {
  return (
    <SidebarContent title="Variables" helpContent={variablesHelp}>
      <GlobalVariablesTable />
    </SidebarContent>
  );
}

// file types we support for drag/drop
const allowedDropExtensions = [".bag", ".foxe", ".urdf", ".xacro"];

type WorkspaceProps = {
  loadWelcomeLayout?: boolean;
  demoBagUrl?: string;
  deepLinks?: string[];
};

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerCapabilities = ({ playerState }: MessagePipelineContext) =>
  playerState.capabilities;
const selectRequestBackfill = ({ requestBackfill }: MessagePipelineContext) => requestBackfill;
const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;

export default function Workspace(props: WorkspaceProps): JSX.Element {
  const classes = useStyles();
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const { selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerCapabilities = useMessagePipeline(selectPlayerCapabilities);
  const playerProblems = useMessagePipeline(selectPlayerProblems);

  // we use requestBackfill to signal when a player changes for RemountOnValueChange below
  // see comment below above the RemountOnValueChange component
  const requestBackfill = useMessagePipeline(selectRequestBackfill);

  const [selectedSidebarItem, setSelectedSidebarItem] = useState<SidebarItemKey | undefined>(
    // Start with the sidebar open if no connection has been made
    playerPresence === PlayerPresence.NOT_PRESENT ? "connection" : undefined,
  );

  // When a player is present we hide the connection sidebar. To prevent hiding the connection sidebar
  // when the user wants to select a new connection we track whether the sidebar item opened
  const userSelectSidebarItem = useRef(false);

  const selectSidebarItem = useCallback((item: SidebarItemKey | undefined) => {
    userSelectSidebarItem.current = true;
    setSelectedSidebarItem(item);
  }, []);

  // Automatically close the connection sidebar when a connection is chosen
  useLayoutEffect(() => {
    if (userSelectSidebarItem.current) {
      userSelectSidebarItem.current = false;
      return;
    }

    if (selectedSidebarItem === "connection" && playerPresence !== PlayerPresence.NOT_PRESENT) {
      setSelectedSidebarItem(undefined);
    }
  }, [selectedSidebarItem, playerPresence]);

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [messagePathSyntaxModalOpen, setMessagePathSyntaxModalOpen] = useState(false);

  const isMounted = useMountedState();

  const layoutStorage = useLayoutManager();
  const { setSelectedLayoutId } = useCurrentLayoutActions();

  const openWelcomeLayout = useCallback(async () => {
    const newLayout = await layoutStorage.saveNewLayout({
      name: welcomeLayout.name,
      data: welcomeLayout.data,
      permission: "creator_write",
    });
    if (isMounted()) {
      setSelectedLayoutId(newLayout.id);
      if (props.demoBagUrl) {
        selectSource(
          { name: "Demo Bag", type: "ros1-remote-bagfile" },
          {
            url: props.demoBagUrl,
          },
        );
      }
    }
  }, [layoutStorage, isMounted, setSelectedLayoutId, props.demoBagUrl, selectSource]);

  const handleInternalLink = useCallback((event: React.MouseEvent, href: string) => {
    if (href === "#help:message-path-syntax") {
      event.preventDefault();
      setMessagePathSyntaxModalOpen(true);
    }
  }, []);

  useEffect(() => {
    // Focus on page load to enable keyboard interaction.
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  useNativeAppMenuEvent(
    "open-preferences",
    useCallback(() => {
      setSelectedSidebarItem((item) => (item === "preferences" ? undefined : "preferences"));
    }, []),
  );

  useNativeAppMenuEvent(
    "open-message-path-syntax-help",
    useCallback(() => setMessagePathSyntaxModalOpen(true), []),
  );

  useNativeAppMenuEvent(
    "open-keyboard-shortcuts",
    useCallback(() => setShortcutsModalOpen(true), []),
  );

  useNativeAppMenuEvent("open-welcome-layout", openWelcomeLayout);

  const appConfiguration = useAppConfiguration();
  const { addToast } = useToasts();

  // Show welcome layout on first run
  useMount(() => {
    void (async () => {
      const welcomeLayoutShown = appConfiguration.get("onboarding.welcome-layout.shown");
      if (welcomeLayoutShown !== true || props.loadWelcomeLayout === true) {
        await appConfiguration.set("onboarding.welcome-layout.shown", true);
        await openWelcomeLayout();
      }
    })();
  });

  // previously loaded files are tracked so support the "add bag" feature which loads a second bag
  // file when the user presses shift during a drag/drop
  const previousFiles = useRef<File[]>([]);

  const { loadFromFile } = useAssets();

  const extensionLoader = useExtensionLoader();

  const openFiles = useCallback(
    async (files: FileList, { shiftPressed }: { shiftPressed: boolean }) => {
      const otherFiles: File[] = [];
      for (const file of files) {
        // electron extends File with a `path` field which is not available in browsers
        const basePath = (file as { path?: string }).path ?? "";

        if (file.name.endsWith(".foxe")) {
          // Extension installation
          try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const extension = await extensionLoader.installExtension(data);
            addToast(`Installed extension ${extension.id}`, { appearance: "success" });
          } catch (err) {
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
            addToast(`Failed to load ${file.name}`, {
              appearance: "error",
            });
          }
        }
      }

      if (otherFiles.length > 0) {
        if (shiftPressed) {
          previousFiles.current = previousFiles.current.concat(otherFiles);
        } else {
          previousFiles.current = otherFiles;
        }
        selectSource(
          { name: "ROS 1 Bag File (local)", type: "ros1-local-bagfile" },
          {
            files: previousFiles.current,
          },
        );
      }
    },
    [addToast, extensionLoader, loadFromFile, selectSource],
  );

  // files the main thread told us to open
  const filesToOpen = useElectronFilesToOpen();
  useEffect(() => {
    if (filesToOpen) {
      void openFiles(filesToOpen, { shiftPressed: false });
    }
  }, [filesToOpen, openFiles]);

  useEffect(() => {
    const firstLink = props.deepLinks?.[0];
    if (firstLink == undefined) {
      return;
    }

    try {
      const url = new URL(firstLink);
      // only support the open command

      // Test if the pathname matches //open or //open/
      if (!/\/\/open\/?/.test(url.pathname)) {
        return;
      }

      // only support rosbag urls
      const type = url.searchParams.get("type");
      const bagUrl = url.searchParams.get("url");
      if (type !== "rosbag" || bagUrl == undefined) {
        return;
      }
      selectSource(
        {
          name: "ROS 1 Bag File (HTTP)",
          type: "ros1-remote-bagfile",
        },
        { url: bagUrl },
      );
    } catch (err) {
      log.error(err);
    }
  }, [props.deepLinks, selectSource]);

  const dropHandler = useCallback(
    ({ files, shiftPressed }: { files: FileList; shiftPressed: boolean }) => {
      void openFiles(files, { shiftPressed });
    },
    [openFiles],
  );

  const showPlaybackControls =
    playerPresence === PlayerPresence.NOT_PRESENT || playerCapabilities.includes("playbackControl");

  const workspaceActions = useMemo(
    () => ({
      panelSettingsOpen: selectedSidebarItem === "panel-settings",
      openPanelSettings: () => setSelectedSidebarItem("panel-settings"),
      openAccountSettings: () => setSelectedSidebarItem("account"),
    }),
    [selectedSidebarItem],
  );

  const [enableSharedLayouts = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_CONSOLE_API_LAYOUTS,
  );

  const { currentUser } = useCurrentUser();

  const sidebarItems = useMemo<Map<SidebarItemKey, SidebarItem>>(() => {
    const connectionItem: SidebarItem = {
      iconName: "DataManagementSettings",
      title: "Connection",
      component: Connection,
    };

    if (playerProblems && playerProblems.length > 0) {
      connectionItem.badge = {
        count: playerProblems.length,
      };
    }

    const SIDEBAR_ITEMS = new Map<SidebarItemKey, SidebarItem>([
      ["connection", connectionItem],
      ["layouts", { iconName: "FiveTileGrid", title: "Layouts", component: LayoutBrowser }],
      ["add-panel", { iconName: "RectangularClipping", title: "Add panel", component: AddPanel }],
      [
        "panel-settings",
        { iconName: "SingleColumnEdit", title: "Panel settings", component: PanelSettings },
      ],
      ["variables", { iconName: "Variable2", title: "Variables", component: Variables }],
      ["preferences", { iconName: "Settings", title: "Preferences", component: Preferences }],
      ["extensions", { iconName: "AddIn", title: "Extensions", component: ExtensionsSidebar }],
    ]);

    return enableSharedLayouts
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
  }, [enableSharedLayouts, playerProblems, currentUser]);

  const sidebarBottomItems: readonly SidebarItemKey[] = useMemo(() => {
    return enableSharedLayouts ? ["account", "preferences"] : ["preferences"];
  }, [enableSharedLayouts]);

  return (
    <MultiProvider
      providers={[
        /* eslint-disable react/jsx-key */
        <LinkHandlerContext.Provider value={handleInternalLink} />,
        <WorkspaceContext.Provider value={workspaceActions} />,
        /* eslint-enable react/jsx-key */
      ]}
    >
      <DocumentDropListener filesSelected={dropHandler} allowedExtensions={allowedDropExtensions}>
        <DropOverlay>
          <div className={classes.dropzone}>Drop a file here</div>
        </DropOverlay>
      </DocumentDropListener>
      <div className={classes.container} ref={containerRef} tabIndex={0}>
        {shortcutsModalOpen && (
          <ShortcutsModal onRequestClose={() => setShortcutsModalOpen(false)} />
        )}
        {messagePathSyntaxModalOpen && (
          <HelpModal onRequestClose={() => setMessagePathSyntaxModalOpen(false)}>
            {messagePathHelp}
          </HelpModal>
        )}
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
              {showPlaybackControls && (
                <Stack.Item disableShrink>
                  <PlaybackControls />
                </Stack.Item>
              )}
            </Stack>
          </RemountOnValueChange>
        </Sidebar>
      </div>
    </MultiProvider>
  );
}
