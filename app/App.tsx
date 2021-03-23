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
import { importPanelLayout, loadLayout } from "@foxglove-studio/app/actions/panels";
import AddPanelMenu from "@foxglove-studio/app/components/AddPanelMenu";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import { ExperimentalFeaturesModal } from "@foxglove-studio/app/components/ExperimentalFeaturesModal";
import Flex from "@foxglove-studio/app/components/Flex";
import GlobalKeyListener from "@foxglove-studio/app/components/GlobalKeyListener";
import GlobalVariablesMenu from "@foxglove-studio/app/components/GlobalVariablesMenu";
import { WrappedIcon } from "@foxglove-studio/app/components/Icon";
import LayoutMenu from "@foxglove-studio/app/components/LayoutMenu";
import LayoutStorageReduxAdapter from "@foxglove-studio/app/components/LayoutStorageReduxAdapter";
import { NativeFileMenuPlayerSelection } from "@foxglove-studio/app/components/NativeFileMenuPlayerSelection";
import NotificationDisplay from "@foxglove-studio/app/components/NotificationDisplay";
import PanelLayout from "@foxglove-studio/app/components/PanelLayout";
import PlaybackControls from "@foxglove-studio/app/components/PlaybackControls";
import PlayerManager from "@foxglove-studio/app/components/PlayerManager";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import ShortcutsModal from "@foxglove-studio/app/components/ShortcutsModal";
import TinyConnectionPicker from "@foxglove-studio/app/components/TinyConnectionPicker";
import Toolbar from "@foxglove-studio/app/components/Toolbar";
import { useAppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";
import ExperimentalFeaturesLocalStorageProvider from "@foxglove-studio/app/context/ExperimentalFeaturesLocalStorageProvider";
import OsContextAppConfigurationProvider from "@foxglove-studio/app/context/OsContextAppConfigurationProvider";
import OsContextLayoutStorageProvider from "@foxglove-studio/app/context/OsContextLayoutStorageProvider";
import {
  PlayerSourceDefinition,
  usePlayerSelection,
} from "@foxglove-studio/app/context/PlayerSelectionContext";
import experimentalFeatures from "@foxglove-studio/app/experimentalFeatures";
import welcomeLayout from "@foxglove-studio/app/layouts/welcomeLayout";
import getGlobalStore from "@foxglove-studio/app/store/getGlobalStore";
import browserHistory from "@foxglove-studio/app/util/history";
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
  useEffect(() => {
    // Focus on page load to enable keyboard interaction.
    if (containerRef.current) {
      containerRef.current.focus();
    }
    // Add a hook for integration tests.
    (window as any).setPanelLayout = (payload: any) => dispatch(importPanelLayout(payload));
  }, [dispatch]);

  const { currentSourceName, setPlayerFromDemoBag } = usePlayerSelection();

  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

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
  useEffect(() => {
    OsContextSingleton?.addIpcEventListener("enter-full-screen", () => setFullScreen(true));
    OsContextSingleton?.addIpcEventListener("leave-full-screen", () => setFullScreen(false));

    OsContextSingleton?.addIpcEventListener("open-preferences", () => setPreferencesOpen(true));
    OsContextSingleton?.addIpcEventListener("open-keyboard-shortcuts", () =>
      setShortcutsModalOpen(true),
    );
    OsContextSingleton?.addIpcEventListener("open-welcome-layout", () => openWelcomeLayout());
  }, [openWelcomeLayout]);

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
        await openWelcomeLayout();
        await appConfiguration.set("onboarding.welcome-layout.shown", true);
      }
    })();
  }, [appConfiguration, openWelcomeLayout]);

  return (
    <div ref={containerRef} className="app-container" tabIndex={0}>
      <GlobalKeyListener
        history={browserHistory}
        openShortcutsModal={() => setShortcutsModalOpen(true)}
      />
      {shortcutsModalOpen && <ShortcutsModal onRequestClose={() => setShortcutsModalOpen(false)} />}

      <Toolbar style={toolbarStyle} onDoubleClick={OsContextSingleton?.handleToolbarDoubleClick}>
        <SToolbarItem>
          <TinyConnectionPicker />
        </SToolbarItem>
        <SToolbarItem>{currentSourceName ?? "Select a data source"}</SToolbarItem>
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
  );
}

export default function App(): ReactElement {
  const globalStore = getGlobalStore();

  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "Bag File",
      type: "file",
    },
    {
      name: "WebSocket",
      type: "ws",
    },
    {
      name: "HTTP",
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
