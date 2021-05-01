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

import { ActionButton, Modal } from "@fluentui/react";
import AlertIcon from "@mdi/svg/svg/alert.svg";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useToasts } from "react-toast-notifications";
import { useMountedState } from "react-use";
import styled from "styled-components";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import { redoLayoutChange, undoLayoutChange } from "@foxglove-studio/app/actions/layoutHistory";
import { importPanelLayout, loadLayout } from "@foxglove-studio/app/actions/panels";
import AddPanelMenu from "@foxglove-studio/app/components/AddPanelMenu";
import DocumentDropListener from "@foxglove-studio/app/components/DocumentDropListener";
import DropOverlay from "@foxglove-studio/app/components/DropOverlay";
import GlobalKeyListener from "@foxglove-studio/app/components/GlobalKeyListener";
import GlobalVariablesMenu from "@foxglove-studio/app/components/GlobalVariablesMenu";
import HelpModal from "@foxglove-studio/app/components/HelpModal";
import Icon from "@foxglove-studio/app/components/Icon";
import LayoutMenu from "@foxglove-studio/app/components/LayoutMenu";
import messagePathHelp from "@foxglove-studio/app/components/MessagePathSyntax/index.help.md";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import NotificationDisplay from "@foxglove-studio/app/components/NotificationDisplay";
import PanelLayout from "@foxglove-studio/app/components/PanelLayout";
import PlaybackControls from "@foxglove-studio/app/components/PlaybackControls";
import Preferences from "@foxglove-studio/app/components/Preferences";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import ShortcutsModal from "@foxglove-studio/app/components/ShortcutsModal";
import SpinningLoadingIcon from "@foxglove-studio/app/components/SpinningLoadingIcon";
import TinyConnectionPicker from "@foxglove-studio/app/components/TinyConnectionPicker";
import Toolbar from "@foxglove-studio/app/components/Toolbar";
import { useAppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";
import { useAssets } from "@foxglove-studio/app/context/AssetContext";
import LinkHandlerContext from "@foxglove-studio/app/context/LinkHandlerContext";
import { usePlayerSelection } from "@foxglove-studio/app/context/PlayerSelectionContext";
import useElectronFilesToOpen from "@foxglove-studio/app/hooks/useElectronFilesToOpen";
import welcomeLayout from "@foxglove-studio/app/layouts/welcomeLayout";
import { PlayerPresence } from "@foxglove-studio/app/players/types";
import { ImportPanelLayoutPayload } from "@foxglove-studio/app/types/panels";
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

// file types we support for drag/drop
const allowedDropExtensions = [".bag", ".urdf"];

export default function Workspace(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const dispatch = useDispatch();
  const { currentSourceName, setPlayerFromFiles, setPlayerFromDemoBag } = usePlayerSelection();
  const playerPresence = useMessagePipeline(
    useCallback(({ playerState }) => playerState.presence, []),
  );
  const playerCapabilities = useMessagePipeline(
    useCallback(({ playerState }) => playerState.capabilities, []),
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [messagePathSyntaxModalOpen, setMessagePathSyntaxModalOpen] = useState(false);

  const isMounted = useMountedState();

  const openWelcomeLayout = useCallback(async () => {
    if (isMounted()) {
      dispatch(loadLayout(welcomeLayout));
      await setPlayerFromDemoBag();
    }
  }, [dispatch, setPlayerFromDemoBag, isMounted]);

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

    // For undo/redo events, first try the browser's native undo/redo, and if that is disabled, then
    // undo/redo the layout history. Note that in GlobalKeyListener we also handle the keyboard
    // events for undo/redo, so if an input or textarea element that would handle the event is not
    // focused, the GlobalKeyListener will handle it. The listeners here are to handle the case when
    // an editable element is focused, or when the user directly chooses the undo/redo menu item.
    OsContextSingleton?.addIpcEventListener("undo", () => {
      if (!document.execCommand("undo")) {
        dispatch(undoLayoutChange());
      }
    });
    OsContextSingleton?.addIpcEventListener("redo", () => {
      if (!document.execCommand("redo")) {
        dispatch(redoLayoutChange());
      }
    });

    OsContextSingleton?.addIpcEventListener("open-preferences", () => setPreferencesOpen(true));
    OsContextSingleton?.addIpcEventListener("open-message-path-syntax-help", () =>
      setMessagePathSyntaxModalOpen(true),
    );
    OsContextSingleton?.addIpcEventListener("open-keyboard-shortcuts", () =>
      setShortcutsModalOpen(true),
    );
    OsContextSingleton?.addIpcEventListener("open-welcome-layout", () => openWelcomeLayout());
  }, [dispatch, openWelcomeLayout]);

  const appConfiguration = useAppConfiguration();
  const { addToast } = useToasts();

  // Show welcome layout on first run
  useEffect(() => {
    (async () => {
      const welcomeLayoutShown = await appConfiguration.get("onboarding.welcome-layout.shown");
      if (!welcomeLayoutShown) {
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
          if (!(await loadFromFile(file, { basePath: file.path }))) {
            otherFiles.push(file);
          }
        } catch (err) {
          addToast(`Failed to load ${file.name}`, {
            appearance: "error",
          });
        }
      }

      if (otherFiles.length > 0) {
        setPlayerFromFiles(otherFiles, { append: shiftPressed });
      }
    },
    [addToast, loadFromFile, setPlayerFromFiles],
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

  const presenceIcon = (() => {
    switch (playerPresence) {
      case PlayerPresence.NOT_PRESENT:
      case PlayerPresence.PRESENT:
        return undefined;
      case PlayerPresence.CONSTRUCTING:
      case PlayerPresence.INITIALIZING:
      case PlayerPresence.RECONNECTING:
        return (
          <Icon small style={{ paddingLeft: 10 }}>
            <SpinningLoadingIcon />
          </Icon>
        );
      case PlayerPresence.ERROR:
        return (
          <Icon small style={{ paddingLeft: 10 }}>
            <AlertIcon />
          </Icon>
        );
    }
  })();

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
            {presenceIcon}
          </SToolbarItem>
          <div style={{ flexGrow: 1 }}></div>
          <SToolbarItem style={{ marginRight: 5 }}>
            {!inAutomatedRunMode() && <NotificationDisplay />}
          </SToolbarItem>
          <SToolbarItem>
            <LayoutMenu />
          </SToolbarItem>
          <SToolbarItem>
            <AddPanelMenu />
          </SToolbarItem>
          <SToolbarItem>
            <GlobalVariablesMenu />
          </SToolbarItem>
          <SToolbarItem>
            <ActionButton
              iconProps={{
                iconName: "Settings",
                styles: { root: { "& span": { verticalAlign: "baseline" } } },
              }}
              onClick={() => setPreferencesOpen(true)}
            />
            <Modal
              styles={{ main: { width: "80vw", maxWidth: 850, height: "80vh", maxHeight: 600 } }}
              isOpen={preferencesOpen}
              onDismiss={() => setPreferencesOpen(false)}
            >
              <Preferences />
            </Modal>
          </SToolbarItem>
        </Toolbar>
        <PanelLayout />
        {showPlaybackControls && <PlaybackControls />}
      </div>
    </LinkHandlerContext.Provider>
  );
}
