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
import React, { useCallback, useMemo, forwardRef, ElementRef } from "react";
import {
  MosaicWithoutDragDropContext,
  MosaicWindow,
  MosaicDumbWindow,
} from "react-mosaic-component";
import { useSelector, useDispatch } from "react-redux";
import "react-mosaic-component/react-mosaic-component.css";
import { bindActionCreators } from "redux";

import ErrorBoundary from "./ErrorBoundary";
import "./PanelLayout.scss";
import { setMosaicId } from "@foxglove-studio/app/actions/mosaic";
import {
  changePanelLayout,
  savePanelConfigs,
  SAVE_PANEL_CONFIGS,
} from "@foxglove-studio/app/actions/panels";
import Flex from "@foxglove-studio/app/components/Flex";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import PanelList from "@foxglove-studio/app/panels/PanelList";
import { EmptyDropTarget } from "@foxglove-studio/app/panels/Tab/EmptyDropTarget";
import { State, Dispatcher } from "@foxglove-studio/app/reducers";
import { MosaicNode, SaveConfigsPayload } from "@foxglove-studio/app/types/panels";
import { getPanelIdForType, getPanelTypeFromId } from "@foxglove-studio/app/util/layout";

type Props = {
  layout?: MosaicNode;
  onChange: (panels: any) => void;
  setMosaicId: (mosaicId: string) => void;
  savePanelConfigs: (arg0: SaveConfigsPayload) => Dispatcher<SAVE_PANEL_CONFIGS>;
  forwardedRef?: ElementRef<any>;
  mosaicId?: string;
  tabId?: string;

  /*
   * React mosaic adds a DropTarget wrapper around the mosaic root; remove for
   * Tab panels so that users can correctly drag panels in from the outer
   * layout.
   */
  removeRootDropTarget?: boolean;
};

// we subclass the mosaic layout without dragdropcontext
// dragdropcontext is initialized in the App container
// so components outside the mosaic component can participate
class MosaicRoot extends MosaicWithoutDragDropContext {
  componentDidMount() {
    // set the mosaic id in redux so elements outside the container
    // can use the id to register their drag intents with mosaic drop targets
    (this.props as any).setMosaicId(this.state.mosaicId);
  }
}

export function UnconnectedPanelLayout(props: Props) {
  const {
    layout,
    onChange,
    savePanelConfigs: saveConfigs,
    tabId,
    removeRootDropTarget,
    mosaicId,
  } = props;
  const createTile = useCallback(
    (config: any) => {
      const defaultPanelType = "RosOut";
      const type = config ? config.type || defaultPanelType : defaultPanelType;
      const id = getPanelIdForType(type);
      if (config.panelConfig) {
        saveConfigs({ configs: [{ id, config: config.panelConfig }] });
      }
      return id;
    },
    [saveConfigs],
  );

  const renderTile = useCallback(
    (id: string, path: any) => {
      // `id` is usually a string. But when `layout` is empty, `id` will be an empty object, in which case we don't need to render Tile
      if (!id || typeof id !== "string") {
        return;
      }
      const type = getPanelTypeFromId(id);

      const PanelComponent = PanelList.getComponentForType(type);
      const panel = PanelComponent ? (
        <PanelComponent childId={id} tabId={tabId} />
      ) : (
        // If we haven't found a panel of the given type, render the panel selector
        // @ts-expect-error typings say title is required property?
        <MosaicWindow path={path} createNode={createTile} renderPreview={() => undefined}>
          <Flex col center>
            <PanelToolbar floating isUnknownPanel />
            Unknown panel type: {type}.
          </Flex>
        </MosaicWindow>
      );

      const MosaicWindowComponent: any = type === "Tab" ? MosaicDumbWindow : MosaicWindow;
      return (
        <MosaicWindowComponent
          key={path}
          path={path}
          createNode={createTile}
          renderPreview={() => undefined}
          tabId={tabId}
        >
          {panel}
        </MosaicWindowComponent>
      );
    },
    [createTile, tabId],
  );
  const isDemoMode = useExperimentalFeature("demoMode");
  const bodyToRender = useMemo(
    () =>
      layout ? (
        <MosaicRoot
          renderTile={renderTile as any}
          className={isDemoMode ? "borderless" : "none"}
          resize={{ minimumPaneSizePercentage: 2 }}
          value={layout}
          onChange={onChange}
          // @ts-expect-error setMosaicId property does not exist?
          setMosaicId={props.setMosaicId}
          mosaicId={mosaicId}
          removeRootDropTarget={removeRootDropTarget}
        />
      ) : (
        <EmptyDropTarget tabId={tabId} mosaicId={mosaicId} />
      ),
    [
      isDemoMode,
      layout,
      mosaicId,
      onChange,
      props.setMosaicId,
      removeRootDropTarget,
      renderTile,
      tabId,
    ],
  );

  return <ErrorBoundary ref={props.forwardedRef as any}>{bodyToRender}</ErrorBoundary>;
}

const ConnectedPanelLayout = (_: any, ref: any) => {
  const layout = useSelector((state: State) => state.persistedState.panels.layout);
  const dispatch = useDispatch();
  const actions = React.useMemo(
    () => bindActionCreators({ changePanelLayout, savePanelConfigs, setMosaicId }, dispatch),
    [dispatch],
  );
  const onChange = useCallback(
    (newLayout: MosaicNode) => {
      actions.changePanelLayout({ layout: newLayout });
    },
    [actions],
  );
  return (
    <UnconnectedPanelLayout
      forwardedRef={ref}
      layout={layout}
      onChange={onChange}
      savePanelConfigs={actions.savePanelConfigs}
      setMosaicId={actions.setMosaicId}
    />
  );
};
export default forwardRef(function PanelLayout(props, ref) {
  return ConnectedPanelLayout(props, ref);
});
