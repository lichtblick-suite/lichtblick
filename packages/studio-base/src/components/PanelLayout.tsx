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

import { Link, Spinner, SpinnerSize } from "@fluentui/react";
import React, {
  useCallback,
  useMemo,
  PropsWithChildren,
  Suspense,
  useRef,
  LazyExoticComponent,
} from "react";
import { useDrop } from "react-dnd";
import {
  MosaicWithoutDragDropContext,
  MosaicWindow,
  MosaicDragType,
  MosaicNode,
  MosaicPath,
} from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import styled from "styled-components";

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Flex from "@foxglove/studio-base/components/Flex";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
  usePanelMosaicId,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelComponent, usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { EmptyDropTarget } from "@foxglove/studio-base/panels/Tab/EmptyDropTarget";
import { MosaicDropResult, PanelConfig } from "@foxglove/studio-base/types/panels";
import { getPanelIdForType, getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import ErrorBoundary from "./ErrorBoundary";

type Props = {
  layout?: MosaicNode<string>;
  onChange: (panels: MosaicNode<string> | undefined) => void;
  tabId?: string;
};

// CSS hack to disable the first level of drop targets inside a Tab's own mosaic window (that would
// place the dropped item as a sibling of the Tab), as well as the "root drop targets" inside the
// nested mosaic (that would place the dropped item as a direct child of the Tab). Makes it easier
// to drop panels into a tab layout.
const HideTopLevelDropTargets = styled.div.attrs({ style: { margin: 0 } })`
  .mosaic-root + .drop-target-container {
    display: none !important;
  }
  & > .mosaic-window > .drop-target-container {
    display: none !important;
  }
`;

// This wrapper makes the tabId available in the drop result when something is dropped into a nested
// drop target. This allows a panel to know which mosaic it was dropped in regardless of nesting
// level.
function TabMosaicWrapper({ tabId, children }: PropsWithChildren<{ tabId?: string }>) {
  const [, drop] = useDrop<unknown, MosaicDropResult, never>({
    accept: MosaicDragType.WINDOW,
    drop: (_item, monitor) => {
      const nestedDropResult = monitor.getDropResult<MosaicDropResult>();
      if (nestedDropResult) {
        // The drop result may already have a tabId if it was dropped in a more deeply-nested Tab
        // mosaic. Provide our tabId only if there wasn't one already.
        return { tabId, ...nestedDropResult };
      }
      return undefined;
    },
  });
  return (
    <HideTopLevelDropTargets className="mosaic-tile" ref={drop}>
      {children}
    </HideTopLevelDropTargets>
  );
}

export function UnconnectedPanelLayout(props: Props): React.ReactElement {
  const { savePanelConfigs } = useCurrentLayoutActions();
  const mosaicId = usePanelMosaicId();
  const { layout, onChange, tabId } = props;
  const createTile = useCallback(
    (config?: { type?: string; panelConfig?: PanelConfig }) => {
      const defaultPanelType = "RosOut";
      const type = config?.type ? config.type : defaultPanelType;
      const id = getPanelIdForType(type);
      if (config?.panelConfig) {
        savePanelConfigs({ configs: [{ id, config: config.panelConfig }] });
      }
      return id;
    },
    [savePanelConfigs],
  );

  const panelCatalog = usePanelCatalog();

  const panelCompoentCache = useRef(
    new Map<string, LazyExoticComponent<PanelComponent> | (() => JSX.Element)>(),
  );
  const renderTile = useCallback(
    (id: string | Record<string, never> | undefined, path: MosaicPath) => {
      // `id` is usually a string. But when `layout` is empty, `id` will be an empty object, in which case we don't need to render Tile
      if (id == undefined || typeof id !== "string") {
        return <></>;
      }
      const type = getPanelTypeFromId(id);

      let Panel = panelCompoentCache.current.get(type);

      // cache the lazy created panel component to avoid making the component again
      if (!Panel) {
        const panelInfo = panelCatalog.getPanelByType(type);
        // If we haven't found a panel of the given type, render the panel selector
        Panel = panelInfo
          ? React.lazy(panelInfo.module)
          : () => (
              <Flex col center dataTest={id}>
                <PanelToolbar floating isUnknownPanel />
                Unknown panel type: {type}.
              </Flex>
            );
        panelCompoentCache.current.set(type, Panel);
      }

      const mosaicWindow = (
        <MosaicWindow
          title=""
          key={id}
          path={path}
          createNode={createTile}
          renderPreview={() => undefined as unknown as JSX.Element}
        >
          <Suspense
            fallback={
              <EmptyState>
                <Spinner size={SpinnerSize.large} />
              </EmptyState>
            }
          >
            <Panel childId={id} tabId={tabId} />
          </Suspense>
        </MosaicWindow>
      );
      if (type === "Tab") {
        return <TabMosaicWrapper tabId={id}>{mosaicWindow}</TabMosaicWrapper>;
      }
      return mosaicWindow;
    },
    [createTile, tabId, panelCatalog],
  );
  const bodyToRender = useMemo(
    () =>
      layout != undefined || layout === "" ? (
        <MosaicWithoutDragDropContext
          renderTile={renderTile}
          className="mosaic-foxglove-theme" // prevent the default mosaic theme from being applied
          resize={{ minimumPaneSizePercentage: 2 }}
          value={layout}
          onChange={(newLayout) => onChange(newLayout ?? undefined)}
          mosaicId={mosaicId}
        />
      ) : (
        <EmptyDropTarget tabId={tabId} />
      ),
    [layout, mosaicId, onChange, renderTile, tabId],
  );

  return <ErrorBoundary>{bodyToRender}</ErrorBoundary>;
}

export default function PanelLayout(): JSX.Element {
  const { changePanelLayout } = useCurrentLayoutActions();
  const { openLayoutBrowser } = useWorkspace();
  const layoutLoading = useCurrentLayoutSelector((state) => state.selectedLayout?.loading);
  const selectedLayout = useCurrentLayoutSelector((state) => state.selectedLayout);
  const onChange = useCallback(
    (newLayout: MosaicNode<string> | undefined) => {
      if (newLayout != undefined) {
        changePanelLayout({ layout: newLayout });
      }
    },
    [changePanelLayout],
  );
  if (selectedLayout?.data) {
    return <UnconnectedPanelLayout layout={selectedLayout.data.layout} onChange={onChange} />;
  } else if (layoutLoading === true) {
    return (
      <EmptyState>
        <Spinner size={SpinnerSize.large} />
      </EmptyState>
    );
  } else {
    return (
      <EmptyState>
        <Link onClick={openLayoutBrowser}>Select a layout</Link> in the sidebar to get started!
      </EmptyState>
    );
  }
}
