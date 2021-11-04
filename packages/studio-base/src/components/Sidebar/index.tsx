// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DirectionalHint,
  IIconProps,
  IOverflowSetItemProps,
  makeStyles,
  OverflowSet,
  ResizeGroup,
  ResizeGroupDirection,
  Stack,
  useTheme,
} from "@fluentui/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { MosaicNode, MosaicWithoutDragDropContext } from "react-mosaic-component";
import styled from "styled-components";

import { filterMap } from "@foxglove/den/collection";
import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";

import SidebarButton, { BUTTON_SIZE } from "./SidebarButton";
import { Badge } from "./types";

function Noop(): ReactNull {
  return ReactNull;
}

// Root drop targets in this top level sidebar mosaic interfere with drag/mouse events from the
// PanelList. We don't allow users to edit the mosaic since it's just used for the sidebar, so we
// can hide the drop targets.
const HideRootDropTargets = styled.div`
  & > .mosaic > .drop-target-container {
    display: none !important;
  }
`;

export type SidebarItem = {
  iconName: IIconProps["iconName"];
  title: string;
  badge?: Badge;
  component: React.ComponentType;
};

const useStyles = makeStyles({
  resizeGroup: {
    height: "100%",
    minHeight: 0,
  },
});

export default function Sidebar<K extends string>({
  children,
  items,
  bottomItems,
  selectedKey,
  onSelectKey,
}: React.PropsWithChildren<{
  items: Map<K, SidebarItem>;
  bottomItems: readonly K[];
  selectedKey: K | undefined;
  onSelectKey: (key: K | undefined) => void;
}>): JSX.Element {
  const [mosaicValue, setMosaicValue] = useState<MosaicNode<"sidebar" | "children">>("children");

  const theme = useTheme();
  const classNames = useStyles();

  const prevSelectedKey = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (prevSelectedKey.current !== selectedKey) {
      if (selectedKey == undefined) {
        setMosaicValue("children");
      } else if (prevSelectedKey.current == undefined) {
        setMosaicValue({
          direction: "row",
          first: "sidebar",
          second: "children",
          splitPercentage: 23,
        });
      }
      prevSelectedKey.current = selectedKey;
    }
  }, [selectedKey]);

  const onItemClick = useCallback(
    (key: K) => {
      if (selectedKey === key) {
        onSelectKey(undefined);
      } else {
        onSelectKey(key);
      }
    },
    [onSelectKey, selectedKey],
  );

  const SelectedComponent = (selectedKey != undefined && items.get(selectedKey)?.component) || Noop;

  type OverflowSetItem = IOverflowSetItemProps & { key: K };

  // Callbacks for OverflowSet
  const onRenderItem = useCallback(
    ({ key }: OverflowSetItem) => {
      const item = items.get(key);
      if (!item) {
        throw new Error(`Missing sidebar item ${key}`);
      }
      const { title, iconName } = item;
      return (
        <SidebarButton
          dataSidebarKey={key}
          key={key}
          selected={selectedKey === key}
          title={title}
          iconProps={{ iconName }}
          onClick={() => onItemClick(key)}
          badge={item.badge}
        />
      );
    },
    [items, onItemClick, selectedKey],
  );
  const onRenderOverflowButton = useCallback(
    (overflowItems?: OverflowSetItem[]) => {
      if (!overflowItems) {
        return ReactNull;
      }
      const overflowItemSelected = overflowItems.some(({ key }) => selectedKey === key);
      return (
        <SidebarButton
          dataSidebarKey="_overflow"
          selected={overflowItemSelected}
          title="More"
          iconProps={{ iconName: "MoreVertical" }}
          menuProps={{
            directionalHint: DirectionalHint.rightCenter,
            items: overflowItems.map(({ key }) => {
              const item = items.get(key as K);
              if (!item) {
                throw new Error(`Missing sidebar item ${key}`);
              }
              return {
                key,
                checked: selectedKey === key,
                canCheck: overflowItemSelected,
                text: item.title,
                iconProps: { iconName: item.iconName },
                onClick: () => onItemClick(key),
              };
            }),
          }}
        />
      );
    },
    [items, selectedKey, onItemClick],
  );

  // Data and callbacks for ResizeGroup
  type Data = { itemsToShow: number };
  const onRenderData = useCallback(
    ({ itemsToShow }: Data) => {
      const shownItems = filterMap(items.keys(), (key) =>
        bottomItems.includes(key) ? undefined : { key },
      );
      const overflowItems = shownItems.splice(itemsToShow);

      return (
        <OverflowSet
          vertical
          items={shownItems}
          overflowItems={overflowItems}
          onRenderItem={onRenderItem as (_: IOverflowSetItemProps) => unknown}
          onRenderOverflowButton={onRenderOverflowButton}
        />
      );
    },
    [items, bottomItems, onRenderItem, onRenderOverflowButton],
  );
  const numNonBottomItems = items.size - bottomItems.length;
  const onReduceData = useCallback(
    ({ itemsToShow }: Data) => (itemsToShow === 0 ? undefined : { itemsToShow: itemsToShow - 1 }),
    [],
  );
  const onGrowData = useCallback(
    ({ itemsToShow }: Data) =>
      itemsToShow >= numNonBottomItems ? undefined : { itemsToShow: itemsToShow + 1 },
    [numNonBottomItems],
  );

  return (
    <Stack horizontal verticalFill style={{ overflow: "hidden" }}>
      <Stack
        verticalAlign="space-between"
        styles={{
          root: {
            width: BUTTON_SIZE,
            flexShrink: 0,
            boxSizing: "content-box",
            borderRight: `1px solid ${theme.semanticColors.bodyDivider}`,
            backgroundColor: theme.palette.neutralLighterAlt,
          },
        }}
      >
        <ResizeGroup
          className={classNames.resizeGroup}
          direction={ResizeGroupDirection.vertical}
          data={{ itemsToShow: numNonBottomItems }}
          onRenderData={onRenderData}
          onReduceData={onReduceData}
          onGrowData={onGrowData}
        />
        {bottomItems.map((key) => onRenderItem({ key }))}
      </Stack>
      {
        // By always rendering the mosaic, even if we are only showing children, we can prevent the
        // children from having to re-mount each time the sidebar is opened/closed.
      }
      <HideRootDropTargets style={{ flex: "1 1 100%" }}>
        <MosaicWithoutDragDropContext<"sidebar" | "children">
          className=""
          value={mosaicValue}
          onChange={(value) => value != undefined && setMosaicValue(value)}
          renderTile={(id) => (
            <ErrorBoundary>
              {id === "children" ? (
                (children as JSX.Element)
              ) : (
                <div
                  style={{
                    backgroundColor: theme.palette.neutralLighterAlt,
                    // This box-shadow ensures the background color extends all the way to the
                    // divider despite the default 1px margin around .mosaic-tile.
                    boxShadow: `0 0 0 1px ${theme.palette.neutralLighterAlt}`,
                  }}
                >
                  <SelectedComponent />
                </div>
              )}
            </ErrorBoundary>
          )}
          resize={{ minimumPaneSizePercentage: 10 }}
        />
      </HideRootDropTargets>
    </Stack>
  );
}
