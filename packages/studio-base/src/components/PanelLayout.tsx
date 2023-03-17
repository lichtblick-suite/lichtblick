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

import { CircularProgress, Link, styled as muiStyled, Typography } from "@mui/material";
import React, { PropsWithChildren, Suspense, useCallback, useMemo } from "react";
import { useDrop } from "react-dnd";
import {
  MosaicDragType,
  MosaicNode,
  MosaicPath,
  MosaicWindow,
  MosaicWithoutDragDropContext,
} from "react-mosaic-component";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { EmptyPanelLayout } from "@foxglove/studio-base/components/EmptyPanelLayout";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
  usePanelMosaicId,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import { usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { MosaicDropResult, PanelConfig } from "@foxglove/studio-base/types/panels";
import { getPanelIdForType, getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import ErrorBoundary from "./ErrorBoundary";
import { MosaicPathContext } from "./MosaicPathContext";
import { PanelRemounter } from "./PanelRemounter";
import { UnknownPanel } from "./UnknownPanel";

import "react-mosaic-component/react-mosaic-component.css";

type Props = {
  layout?: MosaicNode<string>;
  onChange: (panels: MosaicNode<string> | undefined) => void;
  tabId?: string;
};

// CSS hack to disable the first level of drop targets inside a Tab's own mosaic window (that would
// place the dropped item as a sibling of the Tab), as well as the "root drop targets" inside the
// nested mosaic (that would place the dropped item as a direct child of the Tab). Makes it easier
// to drop panels into a tab layout.
const HideTopLevelDropTargets = muiStyled("div")`
  margin: 0;

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

  const panelComponents = useMemo(
    () =>
      new Map(
        panelCatalog.getPanels().map((panelInfo) => [panelInfo.type, React.lazy(panelInfo.module)]),
      ),
    [panelCatalog],
  );

  const renderTile = useCallback(
    (id: string | Record<string, never> | undefined, path: MosaicPath) => {
      // `id` is usually a string. But when `layout` is empty, `id` will be an empty object, in which case we don't need to render Tile
      if (id == undefined || typeof id !== "string") {
        return <></>;
      }
      const type = getPanelTypeFromId(id);

      let panel: JSX.Element;
      const PanelComponent = panelComponents.get(type);
      if (PanelComponent) {
        panel = <PanelComponent childId={id} tabId={tabId} />;
      } else {
        // If we haven't found a panel of the given type, render the panel selector
        panel = <UnknownPanel childId={id} tabId={tabId} overrideConfig={{ type, id }} />;
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
                <CircularProgress size={28} />
              </EmptyState>
            }
          >
            <MosaicPathContext.Provider value={path}>
              <PanelRemounter id={id} tabId={tabId}>
                {panel}
              </PanelRemounter>
            </MosaicPathContext.Provider>
          </Suspense>
        </MosaicWindow>
      );
      if (type === "Tab") {
        return <TabMosaicWrapper tabId={id}>{mosaicWindow}</TabMosaicWrapper>;
      }
      return mosaicWindow;
    },
    [panelComponents, createTile, tabId],
  );

  const bodyToRender = useMemo(
    () =>
      layout != undefined ? (
        <MosaicWithoutDragDropContext
          renderTile={renderTile}
          className="mosaic-foxglove-theme" // prevent the default mosaic theme from being applied
          resize={{ minimumPaneSizePercentage: 2 }}
          value={layout}
          onChange={(newLayout) => onChange(newLayout ?? undefined)}
          mosaicId={mosaicId}
        />
      ) : (
        <EmptyPanelLayout tabId={tabId} />
      ),
    [layout, mosaicId, onChange, renderTile, tabId],
  );

  return <ErrorBoundary>{bodyToRender}</ErrorBoundary>;
}

function LoadingState(): JSX.Element {
  return (
    <EmptyState>
      <CircularProgress size={28} />
    </EmptyState>
  );
}

const selectedLayoutLoadingSelector = (state: LayoutState) => state.selectedLayout?.loading;
const selectedLayoutExistsSelector = (state: LayoutState) =>
  state.selectedLayout?.data != undefined;
const selectedLayoutMosaicSelector = (state: LayoutState) => state.selectedLayout?.data?.layout;

export default function PanelLayout(): JSX.Element {
  const { changePanelLayout, setSelectedLayoutId } = useCurrentLayoutActions();
  const { openLayoutBrowser } = useWorkspace();
  const layoutManager = useLayoutManager();
  const layoutExists = useCurrentLayoutSelector(selectedLayoutExistsSelector);
  const layoutLoading = useCurrentLayoutSelector(selectedLayoutLoadingSelector);
  const mosaicLayout = useCurrentLayoutSelector(selectedLayoutMosaicSelector);
  const registeredExtensions = useExtensionCatalog((state) => state.installedExtensions);
  const [enableNewTopNav = false] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);

  const createNewLayout = async () => {
    const layoutData: Omit<LayoutData, "name" | "id"> = {
      configById: {},
      globalVariables: {},
      userNodes: {},
      playbackConfig: defaultPlaybackConfig,
    };

    const layout = await layoutManager.saveNewLayout({
      name: "Default",
      data: layoutData,
      permission: "CREATOR_WRITE",
    });
    setSelectedLayoutId(layout.id);

    if (!enableNewTopNav) {
      openLayoutBrowser();
    }
  };

  const selectExistingLayout = async () => {
    if (!enableNewTopNav) {
      const layouts = await layoutManager.getLayouts();
      if (layouts[0]) {
        setSelectedLayoutId(layouts[0].id);
      }
    }
    openLayoutBrowser();
  };

  const onChange = useCallback(
    (newLayout: MosaicNode<string> | undefined) => {
      if (newLayout != undefined) {
        changePanelLayout({ layout: newLayout });
      }
    },
    [changePanelLayout],
  );

  if (registeredExtensions == undefined) {
    return <LoadingState />;
  }

  if (layoutExists) {
    return <UnconnectedPanelLayout layout={mosaicLayout} onChange={onChange} />;
  }

  if (layoutLoading === true) {
    return <LoadingState />;
  }

  return (
    <EmptyState>
      <Typography display="block" variant="body1" color="text.primary">
        You don&apos;t currently have a layout selected.
      </Typography>
      <Link onClick={selectExistingLayout} underline="hover" color="primary" variant="body1">
        Select an existing layout
      </Link>{" "}
      <Typography display="inline-flex" variant="body1" color="text.primary">
        or
      </Typography>{" "}
      <Link onClick={createNewLayout} underline="hover" color="primary" variant="body1">
        Create a new layout
      </Link>
    </EmptyState>
  );
}
