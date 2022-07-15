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

import { ContextualMenu, IContextualMenuItem, useTheme } from "@fluentui/react";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useCallback, useContext, useMemo, useRef } from "react";
import { MosaicContext, MosaicNode, MosaicWindowContext } from "react-mosaic-component";

import PanelContext from "@foxglove/studio-base/components/PanelContext";
import PanelList, { PanelSelection } from "@foxglove/studio-base/components/PanelList";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import { getPanelTypeFromMosaic } from "@foxglove/studio-base/components/PanelToolbar/utils";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";

type Props = {
  isOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setIsOpen: (_: boolean) => void;
  isUnknownPanel: boolean;
};

export function PanelActionsDropdown({ isOpen, setIsOpen, isUnknownPanel }: Props): JSX.Element {
  const panelContext = useContext(PanelContext);
  const tabId = panelContext?.tabId;
  const { mosaicActions } = useContext(MosaicContext);
  const { mosaicWindowActions } = useContext(MosaicWindowContext);
  const {
    getCurrentLayoutState: getCurrentLayout,
    closePanel,
    splitPanel,
    swapPanel,
  } = useCurrentLayoutActions();
  const getPanelType = useCallback(
    () => getPanelTypeFromMosaic(mosaicWindowActions, mosaicActions),
    [mosaicActions, mosaicWindowActions],
  );

  const close = useCallback(() => {
    closePanel({
      tabId,
      root: mosaicActions.getRoot() as MosaicNode<string>,
      path: mosaicWindowActions.getPath(),
    });
  }, [closePanel, mosaicActions, mosaicWindowActions, tabId]);

  const split = useCallback(
    (id: string | undefined, direction: "row" | "column") => {
      const type = getPanelType();
      if (id == undefined || type == undefined) {
        throw new Error("Trying to split unknown panel!");
      }

      const config = getCurrentLayout().selectedLayout?.data?.configById[id] ?? {};
      splitPanel({
        id,
        tabId,
        direction,
        root: mosaicActions.getRoot() as MosaicNode<string>,
        path: mosaicWindowActions.getPath(),
        config,
      });
    },
    [getCurrentLayout, getPanelType, mosaicActions, mosaicWindowActions, splitPanel, tabId],
  );

  const swap = useCallback(
    (id?: string) =>
      ({ type, config, relatedConfigs }: PanelSelection) => {
        // Reselecting current panel type is a no-op.
        if (type === panelContext?.type) {
          setIsOpen(false);
          return;
        }

        swapPanel({
          tabId,
          originalId: id ?? "",
          type,
          root: mosaicActions.getRoot() as MosaicNode<string>,
          path: mosaicWindowActions.getPath(),
          config: config ?? {},
          relatedConfigs,
        });
      },
    [mosaicActions, mosaicWindowActions, panelContext?.type, setIsOpen, swapPanel, tabId],
  );

  const theme = useTheme();

  const menuItems: IContextualMenuItem[] = useMemo(() => {
    const items: IContextualMenuItem[] = [
      {
        key: "change-panel",
        text: "Change panel",
        onClick: () => undefined,
        iconProps: {
          iconName: "ShapeSubtract",
          styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
        },
        subMenuProps: {
          items: [{ key: "dummy" }],
          calloutProps: {
            // https://github.com/foxglove/studio/issues/2205
            // https://github.com/microsoft/fluentui/issues/18839
            // Lie to the callout and tell it the height of the content so that it keeps the top
            // edge anchored as the user searches panels and the PanelList changes height.
            calloutMaxHeight: 310,
            finalHeight: 310,
            styles: {
              calloutMain: { overflowY: "auto !important" },
            },
          },
          onRenderMenuList: () => (
            <PanelList
              selectedPanelType={panelContext?.type}
              onPanelSelect={swap(panelContext?.id)}
              backgroundColor={theme.semanticColors.menuBackground}
            />
          ),
        },
      },
    ];
    if (!isUnknownPanel) {
      items.push(
        {
          key: "hsplit",
          text: "Split horizontal",
          onClick: () => split(panelContext?.id, "column"),
          iconProps: {
            iconName: "SplitHorizontal",
            styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
          },
        },
        {
          key: "vsplit",
          text: "Split vertical",
          onClick: () => split(panelContext?.id, "row"),
          iconProps: {
            iconName: "SplitVertical",
            styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
          },
        },
      );
    }

    if (panelContext?.isFullscreen !== true) {
      items.push({
        key: "enter-fullscreen",
        text: "Fullscreen",
        onClick: panelContext?.enterFullscreen,
        iconProps: {
          iconName: "FullScreenMaximize",
          styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
        },
        "data-testid": "panel-menu-fullscreen",
      });
    }

    items.push({
      key: "remove",
      text: "Remove panel",
      onClick: close,
      iconProps: { iconName: "Delete" },
      "data-testid": "panel-menu-remove",
    });

    return items;
  }, [
    close,
    isUnknownPanel,
    panelContext?.enterFullscreen,
    panelContext?.id,
    panelContext?.isFullscreen,
    panelContext?.type,
    split,
    swap,
    theme.semanticColors.menuBackground,
  ]);

  const buttonRef = useRef<HTMLDivElement>(ReactNull);

  const type = getPanelType();
  if (type == undefined) {
    return <></>;
  }

  return (
    <div ref={buttonRef}>
      <ContextualMenu
        hidden={!isOpen}
        items={menuItems}
        target={buttonRef}
        onDismiss={() => setIsOpen(false)}
      />
      <ToolbarIconButton title="More" data-testid="panel-menu" onClick={() => setIsOpen(!isOpen)}>
        <MoreVertIcon />
      </ToolbarIconButton>
    </div>
  );
}
