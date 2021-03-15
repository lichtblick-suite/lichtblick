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
import { ReactElement, useState, CSSProperties, useEffect, useMemo, useRef } from "react";
import { DndProvider } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { Provider, useDispatch } from "react-redux";
import styled from "styled-components";

import { OsContextSingleton } from "@foxglove-studio/app/OsContext";
import { importPanelLayout } from "@foxglove-studio/app/actions/panels";
import AddPanelMenu from "@foxglove-studio/app/components/AddPanelMenu";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import { ExperimentalFeaturesModal } from "@foxglove-studio/app/components/ExperimentalFeaturesModal";
import Flex from "@foxglove-studio/app/components/Flex";
import GlobalKeyListener from "@foxglove-studio/app/components/GlobalKeyListener";
import GlobalVariablesMenu from "@foxglove-studio/app/components/GlobalVariablesMenu";
import { WrappedIcon } from "@foxglove-studio/app/components/Icon";
import LayoutMenu from "@foxglove-studio/app/components/LayoutMenu";
import { NativeFileMenuPlayerSelection } from "@foxglove-studio/app/components/NativeFileMenuPlayerSelection";
import NotificationDisplay from "@foxglove-studio/app/components/NotificationDisplay";
import PanelLayout from "@foxglove-studio/app/components/PanelLayout";
import PlaybackControls from "@foxglove-studio/app/components/PlaybackControls";
import PlayerManager from "@foxglove-studio/app/components/PlayerManager";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import ShortcutsModal from "@foxglove-studio/app/components/ShortcutsModal";
import TinyConnectionPicker from "@foxglove-studio/app/components/TinyConnectionPicker";
import Toolbar from "@foxglove-studio/app/components/Toolbar";
import ExperimentalFeaturesLocalStorageProvider from "@foxglove-studio/app/context/ExperimentalFeaturesLocalStorageProvider";
import {
  PlayerSourceDefinition,
  usePlayerSelection,
} from "@foxglove-studio/app/context/PlayerSelectionContext";
import experimentalFeatures from "@foxglove-studio/app/experimentalFeatures";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dispatch = useDispatch();
  useEffect(() => {
    // Focus on page load to enable keyboard interaction.
    if (containerRef.current) {
      containerRef.current.focus();
    }
    // Add a hook for integration tests.
    (window as any).setPanelLayout = (payload: any) => dispatch(importPanelLayout(payload));
  }, [dispatch]);

  const { currentSourceName } = usePlayerSelection();

  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

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
  }, []);

  const toolbarStyle = useMemo<CSSProperties | undefined>(() => {
    const insetWindowControls = OsContextSingleton?.platform === "darwin" && !isFullScreen;
    if (insetWindowControls) {
      return { marginLeft: "78px", borderLeft: "2px groove #29292f" };
    }
  }, [isFullScreen]);

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
    <Provider store={getGlobalStore()}>
      <ExperimentalFeaturesLocalStorageProvider features={experimentalFeatures}>
        <ErrorBoundary>
          <PlayerManager playerSources={playerSources}>
            <NativeFileMenuPlayerSelection />
            <DndProvider backend={HTML5Backend}>
              <Root />
            </DndProvider>
          </PlayerManager>
        </ErrorBoundary>
      </ExperimentalFeaturesLocalStorageProvider>
    </Provider>
  );
}
