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

import AlertIcon from "@mdi/svg/svg/alert.svg";
import CogIcon from "@mdi/svg/svg/cog.svg";
import {
  ReactElement,
  useState,
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { DndProvider } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { Provider, useDispatch } from "react-redux";
import { useMountedState } from "react-use";
import styled from "styled-components";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import { redoLayoutChange, undoLayoutChange } from "@foxglove-studio/app/actions/layoutHistory";
import { importPanelLayout, loadLayout } from "@foxglove-studio/app/actions/panels";
import AddPanelMenu from "@foxglove-studio/app/components/AddPanelMenu";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import { ExperimentalFeaturesModal } from "@foxglove-studio/app/components/ExperimentalFeaturesModal";
import Flex from "@foxglove-studio/app/components/Flex";
import GlobalKeyListener from "@foxglove-studio/app/components/GlobalKeyListener";
import GlobalVariablesMenu from "@foxglove-studio/app/components/GlobalVariablesMenu";
import HelpModal from "@foxglove-studio/app/components/HelpModal";
import Icon, { WrappedIcon } from "@foxglove-studio/app/components/Icon";
import LayoutMenu from "@foxglove-studio/app/components/LayoutMenu";
import LayoutStorageReduxAdapter from "@foxglove-studio/app/components/LayoutStorageReduxAdapter";
import messagePathHelp from "@foxglove-studio/app/components/MessagePathSyntax/index.help.md";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import { NativeFileMenuPlayerSelection } from "@foxglove-studio/app/components/NativeFileMenuPlayerSelection";
import NotificationDisplay from "@foxglove-studio/app/components/NotificationDisplay";
import PanelLayout from "@foxglove-studio/app/components/PanelLayout";
import PlaybackControls from "@foxglove-studio/app/components/PlaybackControls";
import PlayerManager from "@foxglove-studio/app/components/PlayerManager";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import ShortcutsModal from "@foxglove-studio/app/components/ShortcutsModal";
import SpinningLoadingIcon from "@foxglove-studio/app/components/SpinningLoadingIcon";
import TinyConnectionPicker from "@foxglove-studio/app/components/TinyConnectionPicker";
import Toolbar from "@foxglove-studio/app/components/Toolbar";
import { useAppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";
import ExperimentalFeaturesLocalStorageProvider from "@foxglove-studio/app/context/ExperimentalFeaturesLocalStorageProvider";
import LinkHandlerContext from "@foxglove-studio/app/context/LinkHandlerContext";
import OsContextAppConfigurationProvider from "@foxglove-studio/app/context/OsContextAppConfigurationProvider";
import OsContextLayoutStorageProvider from "@foxglove-studio/app/context/OsContextLayoutStorageProvider";
import {
  PlayerSourceDefinition,
  usePlayerSelection,
} from "@foxglove-studio/app/context/PlayerSelectionContext";
import experimentalFeatures from "@foxglove-studio/app/experimentalFeatures";
import welcomeLayout from "@foxglove-studio/app/layouts/welcomeLayout";
import { PlayerPresence } from "@foxglove-studio/app/players/types";
import getGlobalStore from "@foxglove-studio/app/store/getGlobalStore";
import inAutomatedRunMode from "@foxglove-studio/app/util/inAutomatedRunMode";

const SToolbarItem = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  height: 100%;
  min-width: 40px;

  .icon {
    color: white;
  }

  // Allow interacting with buttons in the title bar without dragging the window
  -webkit-app-region: no-drag;
`;
function Root() {
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const dispatch = useDispatch();
  const { currentSourceName, setPlayerFromDemoBag } = usePlayerSelection();
  const playerPresence = useMessagePipeline(
    useCallback(({ playerState }) => playerState.presence, []),
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

  // On MacOS we use inset window controls, when the window is full-screen these controls are not present
  // We detect the full screen state and adjust our rendering accordingly
  // Note: this does not removed the handlers so should be done at the highest component level
  const [isFullScreen, setFullScreen] = useState(false);

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
    (window as any).setPanelLayout = (payload: any) => dispatch(importPanelLayout(payload));

    OsContextSingleton?.addIpcEventListener("enter-full-screen", () => setFullScreen(true));
    OsContextSingleton?.addIpcEventListener("leave-full-screen", () => setFullScreen(false));

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

  const toolbarStyle = useMemo<CSSProperties | undefined>(() => {
    const insetWindowControls = OsContextSingleton?.platform === "darwin" && !isFullScreen;
    if (insetWindowControls) {
      return { marginLeft: "78px", borderLeft: "2px groove #29292f" };
    }
    return undefined;
  }, [isFullScreen]);

  const appConfiguration = useAppConfiguration();

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

  return (
    <LinkHandlerContext.Provider value={handleInternalLink}>
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

        <Toolbar style={toolbarStyle} onDoubleClick={OsContextSingleton?.handleToolbarDoubleClick}>
          <SToolbarItem>
            <TinyConnectionPicker />
          </SToolbarItem>
          <SToolbarItem>
            {currentSourceName ?? "Select a data source"} {presenceIcon}
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
            <Flex center>
              <WrappedIcon medium fade onClick={() => setPreferencesOpen(true)}>
                <CogIcon />
              </WrappedIcon>
              {preferencesOpen && (
                <RenderToBodyComponent>
                  <ExperimentalFeaturesModal onRequestClose={() => setPreferencesOpen(false)} />
                </RenderToBodyComponent>
              )}
            </Flex>
          </SToolbarItem>
        </Toolbar>
        <PanelLayout />
        <PlaybackControls />
      </div>
    </LinkHandlerContext.Provider>
  );
}

export default function App(): ReactElement {
  const globalStore = getGlobalStore();

  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS",
      type: "ros1-core",
    },
    {
      name: "WebSocket",
      type: "ws",
    },
    {
      name: "Bag File (local)",
      type: "file",
    },
    {
      name: "Bag File (HTTP)",
      type: "http",
    },
  ];

  return (
    <OsContextAppConfigurationProvider>
      <Provider store={globalStore}>
        <ExperimentalFeaturesLocalStorageProvider features={experimentalFeatures}>
          <ErrorBoundary>
            <PlayerManager playerSources={playerSources}>
              <NativeFileMenuPlayerSelection />
              <DndProvider backend={HTML5Backend}>
                <OsContextLayoutStorageProvider>
                  <Root />
                  <LayoutStorageReduxAdapter />
                </OsContextLayoutStorageProvider>
              </DndProvider>
            </PlayerManager>
          </ErrorBoundary>
        </ExperimentalFeaturesLocalStorageProvider>
      </Provider>
    </OsContextAppConfigurationProvider>
  );
}
