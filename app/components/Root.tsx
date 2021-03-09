// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import cx from "classnames";
import { CSSProperties, useEffect, useMemo, useRef } from "react";
import { connect, ConnectedProps } from "react-redux";
import { Route } from "react-router";

import styles from "./Root.module.scss";
import { redoLayoutChange, undoLayoutChange } from "@foxglove-studio/app/actions/layoutHistory";
import { importPanelLayout } from "@foxglove-studio/app/actions/panels";
import AddPanelMenu from "@foxglove-studio/app/components/AddPanelMenu";
import { ExperimentalFeaturesMenu } from "@foxglove-studio/app/components/ExperimentalFeatures";
import GlobalVariablesMenu from "@foxglove-studio/app/components/GlobalVariablesMenu";
import LayoutMenu from "@foxglove-studio/app/components/LayoutMenu";
import NotificationDisplay from "@foxglove-studio/app/components/NotificationDisplay";
import PanelLayout from "@foxglove-studio/app/components/PanelLayout";
import PlaybackControls from "@foxglove-studio/app/components/PlaybackControls";
import ShortcutsModal from "@foxglove-studio/app/components/ShortcutsModal";
import TinyConnectionPicker from "@foxglove-studio/app/components/TinyConnectionPicker";
import Toolbar from "@foxglove-studio/app/components/Toolbar";
import withDragDropContext from "@foxglove-studio/app/components/withDragDropContext";
import { usePlayerSelection } from "@foxglove-studio/app/context/PlayerSelectionContext";
import { State } from "@foxglove-studio/app/reducers";
import inAutomatedRunMode from "@foxglove-studio/app/util/inAutomatedRunMode";

const connector = connect(
  ({ layoutHistory: { redoStates, undoStates } }: State) => ({
    redoStateCount: redoStates.length,
    undoStateCount: undoStates.length,
  }),
  { importPanelLayout, redoLayoutChange, undoLayoutChange },
);

type Props = {
  insetWindowControls?: boolean;
  onToolbarDoubleClick?: () => void;
};

type ReduxProps = ConnectedProps<typeof connector>;

function App({
  importPanelLayout: importPanelLayoutProp,
  onToolbarDoubleClick,
  insetWindowControls = false,
}: ReduxProps & Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Focus on page load to enable keyboard interaction.
    if (containerRef.current) {
      containerRef.current.focus();
    }
    // Add a hook for integration tests.
    (window as any).setPanelLayout = (payload: any) => importPanelLayoutProp(payload);
  }, [importPanelLayoutProp]);

  const { currentSourceName } = usePlayerSelection();

  const toolbarStyle = useMemo<CSSProperties | undefined>(() => {
    if (insetWindowControls) {
      return { marginLeft: "78px", borderLeft: "2px groove #29292f" };
    }
  }, [insetWindowControls]);

  return (
    <div ref={containerRef} className="app-container" tabIndex={0}>
      <Route path="/shortcuts" component={ShortcutsModal} />

      <Toolbar style={toolbarStyle} onDoubleClick={onToolbarDoubleClick}>
        <div className={styles.toolbarItem}>
          <TinyConnectionPicker />
        </div>
        <div className={styles.toolbarItem}>{currentSourceName ?? "Select a data source"}</div>
        <div style={{ flexGrow: 1 }}></div>
        <div className={styles.toolbarItem} style={{ marginRight: 5 }}>
          {!inAutomatedRunMode() && <NotificationDisplay />}
        </div>
        <div className={styles.toolbarItem}>
          <LayoutMenu />
        </div>
        <div className={styles.toolbarItem}>
          <AddPanelMenu />
        </div>
        <div className={styles.toolbarItem}>
          <GlobalVariablesMenu />
        </div>
        <div className={styles.toolbarItem}>
          <ExperimentalFeaturesMenu />
        </div>
      </Toolbar>
      <div className={cx(styles.layout, "PanelLayout-root")}>
        <PanelLayout />
      </div>
      <div className={styles["playback-controls"]}>
        <PlaybackControls />
      </div>
    </div>
  );
}

const ConnectedApp = connector(withDragDropContext(App));

const Root = (props: Props) => {
  return <Route path="/" render={() => <ConnectedApp {...props} />} />;
};

export default Root;
