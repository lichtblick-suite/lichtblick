// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Divider, ListItemText, Menu, MenuItem } from "@mui/material";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  MosaicContext,
  MosaicNode,
  MosaicWindowActions,
  MosaicWindowContext,
} from "react-mosaic-component";
import { DeepReadonly } from "ts-essentials";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import { PANEL_ROOT_CLASS_NAME } from "@foxglove/studio-base/components/PanelRoot";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";

/**
 * Types of items that can be included in a context menu. Either a clickable item
 * or a divider.
 */
export type PanelContextMenuItem =
  | {
      /** Type of selectable menu items. */
      type: "item";

      /** True if the item should be shown but disabled. */
      disabled?: boolean;

      /** Label shown for the menu item. */
      label: string;

      /** Callback triggered by clicking the item. */
      onclick: () => void;
    }
  | {
      /** Type of item dividers. */
      type: "divider";
    };

type PanelContextMenuProps = {
  /**
   * Function that returns a list of menu items, optionally dependent on the x,y
   * position of the click.
   */
  itemsForClickPosition: (position: {
    x: number;
    y: number;
  }) => DeepReadonly<PanelContextMenuItem[]>;
};

/**
 * This is a convenience component for attaching a context menu to a panel. It
 * must be a child of a Panel component to work.
 */
export function PanelContextMenu(props: PanelContextMenuProps): JSX.Element {
  const { itemsForClickPosition } = props;

  const rootRef = useRef<HTMLDivElement>(ReactNull);

  const [position, setPosition] = useState<undefined | { x: number; y: number }>();

  const handleClose = useCallback(() => setPosition(undefined), []);

  const { tabId } = usePanelContext();

  const [items, setItems] = useState<undefined | DeepReadonly<PanelContextMenuItem[]>>();

  const listener = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setPosition({ x: event.clientX, y: event.clientY });
      setItems(itemsForClickPosition({ x: event.clientX, y: event.clientY }));
    },
    [itemsForClickPosition],
  );

  const { closePanel } = useCurrentLayoutActions();

  const { mosaicActions } = useContext(MosaicContext);

  const { mosaicWindowActions }: { mosaicWindowActions: MosaicWindowActions } =
    useContext(MosaicWindowContext);

  const removePanel = useCallback(() => {
    closePanel({
      path: mosaicWindowActions.getPath(),
      root: mosaicActions.getRoot() as MosaicNode<string>,
      tabId,
    });
  }, [closePanel, mosaicActions, mosaicWindowActions, tabId]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }

    const parent: HTMLElement | ReactNull = element.closest(`.${PANEL_ROOT_CLASS_NAME}`);
    parent?.addEventListener("contextmenu", listener);

    return () => {
      parent?.removeEventListener("contextmenu", listener);
    };
  }, [listener]);

  const completeItems: DeepReadonly<PanelContextMenuItem[]> = useMemo(() => {
    return [
      ...(items ?? []),
      { type: "divider" },
      {
        type: "item",
        label: "Remove panel",
        onclick: removePanel,
      },
    ];
  }, [items, removePanel]);

  return (
    <div ref={rootRef} onContextMenu={(event) => event.preventDefault()}>
      <Menu
        open={position != undefined}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={position ? { top: position.y, left: position.x } : undefined}
        MenuListProps={{
          dense: true,
        }}
      >
        {completeItems.map((item, index) => {
          if (item.type === "divider") {
            return <Divider variant="middle" key={`divider_${index}`} />;
          }

          return (
            <MenuItem
              onClick={() => {
                handleClose();
                item.onclick();
              }}
              key={`item_${index}_${item.label}`}
              disabled={item.disabled}
            >
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </div>
  );
}
