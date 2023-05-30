// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Divider, ListItemText, Menu, MenuItem } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";

import { Immutable } from "@foxglove/studio";
import { PANEL_ROOT_CLASS_NAME } from "@foxglove/studio-base/components/PanelRoot";

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
  /** @returns List of menu items */
  getItems: () => Immutable<PanelContextMenuItem[]>;
};

/**
 * This is a convenience component for attaching a context menu to a panel. It
 * must be a child of a Panel component to work.
 */
export function PanelContextMenu(props: PanelContextMenuProps): JSX.Element {
  const { getItems } = props;

  const rootRef = useRef<HTMLDivElement>(ReactNull);

  const [position, setPosition] = useState<undefined | { x: number; y: number }>();

  const handleClose = useCallback(() => setPosition(undefined), []);

  const [items, setItems] = useState<Immutable<PanelContextMenuItem[]>>([]);

  useEffect(() => {
    const parent = rootRef.current?.closest<HTMLElement>(`.${PANEL_ROOT_CLASS_NAME}`);
    if (!parent) {
      return;
    }

    // Trigger the menu when the right mouse button is released, but not if the mouse moved in
    // between press & release
    let rightClickState: "none" | "down" | "canceled" = "none";
    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 2 && rightClickState === "down") {
        setPosition({ x: event.clientX, y: event.clientY });
        setItems(getItems());
        rightClickState = "none";
      }
    };
    const handleMouseMove = (_event: MouseEvent) => {
      rightClickState = "canceled";
    };
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 2) {
        rightClickState = "down";
      }
    };
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    parent.addEventListener("mousedown", handleMouseDown);
    parent.addEventListener("mousemove", handleMouseMove);
    parent.addEventListener("mouseup", handleMouseUp);
    parent.addEventListener("contextmenu", handleContextMenu);
    return () => {
      parent.removeEventListener("mousedown", handleMouseDown);
      parent.removeEventListener("mousemove", handleMouseMove);
      parent.removeEventListener("mouseup", handleMouseUp);
      parent.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [getItems]);

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
        {items.map((item, index) => {
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
