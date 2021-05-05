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

import { Stack } from "@fluentui/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useToasts } from "react-toast-notifications";
import { useMountedState } from "react-use";
import styled from "styled-components";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import { redoLayoutChange, undoLayoutChange } from "@foxglove-studio/app/actions/layoutHistory";
import { importPanelLayout, loadLayout } from "@foxglove-studio/app/actions/panels";
import DocumentDropListener from "@foxglove-studio/app/components/DocumentDropListener";
import DropOverlay from "@foxglove-studio/app/components/DropOverlay";
import GlobalKeyListener from "@foxglove-studio/app/components/GlobalKeyListener";
import GlobalVariablesTable from "@foxglove-studio/app/components/GlobalVariablesTable";
import variablesHelp from "@foxglove-studio/app/components/GlobalVariablesTable/index.help.md";
import HelpModal from "@foxglove-studio/app/components/HelpModal";
import LayoutMenu from "@foxglove-studio/app/components/LayoutMenu";
import messagePathHelp from "@foxglove-studio/app/components/MessagePathSyntax/index.help.md";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import NotificationDisplay from "@foxglove-studio/app/components/NotificationDisplay";
import PanelLayout from "@foxglove-studio/app/components/PanelLayout";
import PanelList from "@foxglove-studio/app/components/PanelList";
import PlaybackControls from "@foxglove-studio/app/components/PlaybackControls";
import { PlayerStatusIndicator } from "@foxglove-studio/app/components/PlayerStatusIndicator";
import Preferences from "@foxglove-studio/app/components/Preferences";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import ShortcutsModal from "@foxglove-studio/app/components/ShortcutsModal";
import Sidebar, { SidebarItem } from "@foxglove-studio/app/components/Sidebar";
import { SidebarContent } from "@foxglove-studio/app/components/SidebarContent";
import TinyConnectionPicker from "@foxglove-studio/app/components/TinyConnectionPicker";
import Toolbar from "@foxglove-studio/app/components/Toolbar";
import { useAppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";
import { useAssets } from "@foxglove-studio/app/context/AssetContext";
import LinkHandlerContext from "@foxglove-studio/app/context/LinkHandlerContext";
import { usePlayerSelection } from "@foxglove-studio/app/context/PlayerSelectionContext";
import useElectronFilesToOpen from "@foxglove-studio/app/hooks/useElectronFilesToOpen";
import useNativeAppMenuEvent from "@foxglove-studio/app/hooks/useNativeAppMenuEvent";
import useSelectPanel from "@foxglove-studio/app/hooks/useSelectPanel";
import welcomeLayout from "@foxglove-studio/app/layouts/welcomeLayout";
import { PlayerPresence } from "@foxglove-studio/app/players/types";
import { ImportPanelLayoutPayload } from "@foxglove-studio/app/types/panels";
import { isNonEmptyOrUndefined } from "@foxglove-studio/app/util/emptyOrUndefined";
import inAutomatedRunMode from "@foxglove-studio/app/util/inAutomatedRunMode";

type TestableWindow = Window & { setPanelLayout?: (payload: ImportPanelLayoutPayload) => void };

const SToolbarItem = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  height: 100%;
  min-width: 40px;

  // Allow interacting with buttons in the title bar without dragging the window
  -webkit-app-region: no-drag;
`;

const TruncatedText = styled.span`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  line-height: normal;
`;

type SidebarItemKey = "add-panel" | "variables" | "preferences";

const SIDEBAR_ITEMS = new Map<SidebarItemKey, SidebarItem>([
  ["add-panel", { iconName: "MediaAdd", title: "Add Panel", component: AddPanel }],
  ["variables", { iconName: "Rename", title: "Variables", component: Variables }],
  ["preferences", { iconName: "Settings", title: "Preferences", component: Preferences }],
]);

const SIDEBAR_BOTTOM_ITEMS: readonly SidebarItemKey[] = ["preferences"];

function AddPanel() {
  const selectPanel = useSelectPanel();
  return (
    <SidebarContent noPadding title="Add panel">
      <PanelList onPanelSelect={selectPanel} />
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
const allowedDropExtensions = [".bag", ".urdf"];

export default function Workspace(props: { demoBagUrl?: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const dispatch = useDispatch();
  const { currentSourceName, selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(
    useCallback(({ playerState }) => playerState.presence, []),
  );
  const playerCapabilities = useMessagePipeline(
    useCallback(({ playerState }) => playerState.capabilities, []),
  );
  const [selectedSidebarItem, setSelectedSidebarItem] = useState<SidebarItemKey | undefined>();
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [messagePathSyntaxModalOpen, setMessagePathSyntaxModalOpen] = useState(false);

  const isMounted = useMountedState();

  const openWelcomeLayout = useCallback(async () => {
    if (isMounted()) {
      dispatch(loadLayout(welcomeLayout));
      if (isNonEmptyOrUndefined(props.demoBagUrl)) {
        selectSource(
          { name: "Demo Bag", type: "http" },
          {
            url: props.demoBagUrl,
          },
        );
      }
    }
  }, [isMounted, dispatch, selectSource, props.demoBagUrl]);

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
    // Add a hook for integration tests.
    (window as TestableWindow).setPanelLayout = (payload: ImportPanelLayoutPayload) =>
      dispatch(importPanelLayout(payload));
  }, [dispatch, openWelcomeLayout]);

  // For undo/redo events, first try the browser's native undo/redo, and if that is disabled, then
  // undo/redo the layout history. Note that in GlobalKeyListener we also handle the keyboard
  // events for undo/redo, so if an input or textarea element that would handle the event is not
  // focused, the GlobalKeyListener will handle it. The listeners here are to handle the case when
  // an editable element is focused, or when the user directly chooses the undo/redo menu item.

  useNativeAppMenuEvent(
    "undo",
    useCallback(() => {
      if (!document.execCommand("undo")) {
        dispatch(undoLayoutChange());
      }
    }, [dispatch]),
  );

  useNativeAppMenuEvent(
    "redo",
    useCallback(() => {
      if (!document.execCommand("redo")) {
        dispatch(redoLayoutChange());
      }
    }, [dispatch]),
  );

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
  useEffect(() => {
    (async () => {
      const welcomeLayoutShown = appConfiguration.get("onboarding.welcome-layout.shown");
      if (welcomeLayoutShown == undefined || welcomeLayoutShown === false) {
        // Set configuration *before* opening the layout to avoid infinite recursion when the player
        // loading state causes us to re-render.
        await appConfiguration.set("onboarding.welcome-layout.shown", true);
        await openWelcomeLayout();
      }
    })();
  }, [appConfiguration, openWelcomeLayout]);

  const { loadFromFile } = useAssets();

  const openFiles = useCallback(
    async (files: FileList, { shiftPressed }: { shiftPressed: boolean }) => {
      const otherFiles: File[] = [];
      for (const file of files) {
        try {
          // electron extends File with a `path` field which is not available in browsers
          const basePath = (file as { path?: string }).path ?? "";
          if (!(await loadFromFile(file, { basePath }))) {
            otherFiles.push(file);
          }
        } catch (err) {
          addToast(`Failed to load ${file.name}`, {
            appearance: "error",
          });
        }
      }

      if (otherFiles.length > 0) {
        selectSource(
          { name: "Local Files", type: "file" },
          {
            files: otherFiles,
            append: shiftPressed,
          },
        );
      }
    },
    [addToast, loadFromFile, selectSource],
  );

  // files the main thread told us to open
  const filesToOpen = useElectronFilesToOpen();
  useEffect(() => {
    if (filesToOpen) {
      openFiles(filesToOpen, { shiftPressed: false });
    }
  }, [filesToOpen, openFiles]);

  const dropHandler = useCallback(
    ({ files, shiftPressed }: { files: FileList; shiftPressed: boolean }) => {
      openFiles(files, { shiftPressed });
    },
    [openFiles],
  );

  const showPlaybackControls =
    playerPresence === PlayerPresence.NOT_PRESENT || playerCapabilities.includes("playbackControl");

  return (
    <LinkHandlerContext.Provider value={handleInternalLink}>
      <DocumentDropListener filesSelected={dropHandler} allowedExtensions={allowedDropExtensions}>
        <DropOverlay>
          <div style={{ fontSize: "4em", marginBottom: "1em" }}>Drop a file here</div>
        </DropOverlay>
      </DocumentDropListener>
      <div ref={containerRef} className="app-container" tabIndex={0}>
        <GlobalKeyListener />
        {shortcutsModalOpen && (
          <ShortcutsModal onRequestClose={() => setShortcutsModalOpen(false)} />
        )}
        {messagePathSyntaxModalOpen && (
          <RenderToBodyComponent>
            <HelpModal onRequestClose={() => setMessagePathSyntaxModalOpen(false)}>
              {messagePathHelp}
            </HelpModal>
          </RenderToBodyComponent>
        )}

        <Toolbar onDoubleClick={OsContextSingleton?.handleToolbarDoubleClick}>
          <SToolbarItem>
            <TinyConnectionPicker />
          </SToolbarItem>
          <SToolbarItem style={{ flex: "0 1 auto" }}>
            <TruncatedText>{currentSourceName ?? "Select a data source"}</TruncatedText>{" "}
            <PlayerStatusIndicator />
          </SToolbarItem>
          <div style={{ flexGrow: 1 }}></div>
          <SToolbarItem style={{ marginRight: 5 }}>
            {!inAutomatedRunMode() && <NotificationDisplay />}
          </SToolbarItem>
          <SToolbarItem>
            <LayoutMenu />
          </SToolbarItem>
        </Toolbar>
        <Sidebar
          items={SIDEBAR_ITEMS}
          bottomItems={SIDEBAR_BOTTOM_ITEMS}
          selectedKey={selectedSidebarItem}
          onSelectKey={setSelectedSidebarItem}
        >
          <Stack>
            <PanelLayout />
            {showPlaybackControls && (
              <Stack.Item disableShrink>
                <PlaybackControls />
              </Stack.Item>
            )}
          </Stack>
        </Sidebar>
      </div>
    </LinkHandlerContext.Provider>
  );
}
