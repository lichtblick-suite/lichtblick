// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import DeleteSvg from "@mdi/svg/svg/delete-forever.svg";
import PencilSvg from "@mdi/svg/svg/pencil.svg";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useAsyncRetry } from "react-use";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

import Icon from "@foxglove-studio/app/components/Icon";
import Menu, { Item } from "@foxglove-studio/app/components/Menu";
import { Layout, useLayoutStorage } from "@foxglove-studio/app/context/LayoutStorageContext";
import { State } from "@foxglove-studio/app/reducers";
import { PanelsState } from "@foxglove-studio/app/reducers/panels";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

type LayoutsContextMenuProps = {
  onClose?: () => void;
  onSelectAction?: (layout: Layout) => Promise<void> | void;
  onNewAction?: (layout: Layout) => Promise<void> | void;
  onDeleteAction?: (layout: Layout) => Promise<void>;
  onExportAction?: (layout: Layout) => Promise<void> | void;
  onImportAction?: () => Promise<void> | void;
  onRenameAction?: (layout: Layout) => Promise<void> | void;
};

// Wrap Item with styled so we can reference it in ShowHoverParent
const HoverItem = styled(Item)``;

// ShowsHoverParent shows its content when the user hovers over HoverItem
// We use it to display the rename/delete icons on item hover
// Use visibility so the icons occupy their space while hidden
// This avoids the menu width jumping changing when icons are shown on hover
const ShowHoverParent = styled.div`
  display: flex;
  visibility: hidden;
  ${HoverItem}:hover & {
    visibility: visible;
  }
`;

// LayoutSubMenu is a separate component so we only load the storage list and listen to currentPanelsState
// when the sub menu is mounted (open)
export default function LayoutsContextMenu(props: LayoutsContextMenuProps) {
  const layoutStorage = useLayoutStorage();
  const currentPanelsState = useSelector((state: State) => state.persistedState.panels);
  const [layouts, setLayouts] = useState<Layout[] | undefined>(undefined);

  const { value: asyncLayouts, error, loading, retry: reload } = useAsyncRetry(async () => {
    const list = await layoutStorage.list();
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [layoutStorage]);

  // a basic stale-while-revalidate pattern to avoid flicker of layout menu when we reload the layout list
  // When we re-visit local/remote layouts we will want to look at something like swr (https://swr.vercel.app/)
  // that will handle this and other nice things for us.
  useEffect(() => {
    if (asyncLayouts) {
      setLayouts(asyncLayouts);
    }
  }, [asyncLayouts]);

  const exportToFile = useCallback(() => {
    props.onClose?.();
    props.onExportAction?.({
      id: currentPanelsState.id ?? uuidv4(),
      name: currentPanelsState.name ?? "unnamed",
      state: currentPanelsState,
    });
  }, [currentPanelsState, props]);

  const importFromFile = useCallback(async () => {
    props.onClose?.();
    props.onImportAction?.();
  }, [props]);

  const duplicateLayout = useCallback(() => {
    const name = `${currentPanelsState.name ?? "unnamed"} copy`;
    const id = uuidv4();

    const newState: PanelsState = {
      ...currentPanelsState,
      id: id,
      name: name,
    };

    props.onNewAction?.({
      id: id,
      name: name,
      state: newState,
    });
    props.onClose?.();
  }, [currentPanelsState, props]);

  const deleteLayout = useCallback(
    async (layout: Layout) => {
      // to avoid figuring out which layout to select or what to do when the user deletes the last layout
      // we pevent deleting the current layout
      if (layout.id === currentPanelsState.id) {
        return;
      }

      await props.onDeleteAction?.(layout);

      // Leave the menu open on delete but reload the menu items.
      // This gives visual feedback to the user that their action worked.
      // Also allows them to delete another item, to delete multiple, without re-opening the menu.
      reload();
    },
    [currentPanelsState, props, reload],
  );

  const layoutItems = useMemo(() => {
    if (loading || layouts === undefined) {
      return;
    }

    // Panel state may not have an ID yet. To make highlighting current layout work we need the ID.
    // Here we set one locally until the currentPanelState has one
    const currentId = currentPanelsState.id ?? uuidv4();
    currentPanelsState.id = currentId;

    const currentIdx = layouts.findIndex((layout) => {
      return layout.id === currentId;
    });

    // current panel state is not in our storage layouts list
    if (currentIdx < 0) {
      layouts.push({
        id: currentId,
        name: currentPanelsState.name ?? "unnamed",
        state: currentPanelsState,
      });
    }

    return layouts.map((layout) => (
      <HoverItem
        key={layout.id}
        highlighted={layout.id === currentId}
        onClick={() => {
          props.onClose?.();
          props.onSelectAction?.(layout);
        }}
      >
        <span style={{ flexGrow: 1 }}>{layout.name}</span>
        <ShowHoverParent>
          <Icon xxsmall style={{ marginLeft: "10px", paddingRight: "20px" }} fade>
            <PencilSvg
              onClick={(ev) => {
                // prevent the layout from changing via the Item onClick
                ev.stopPropagation();
                props.onClose?.();
                props.onRenameAction?.(layout);
              }}
            />
          </Icon>
          {/* delete only available for non-current layouts to avoid "what happens when I delete last layout" */}
          {layout.id !== currentId && (
            <Icon xxsmall fade>
              <DeleteSvg
                onClick={(ev) => {
                  // prevent the layout from changing via the Item onClick
                  ev.stopPropagation();
                  deleteLayout(layout);
                }}
              />
            </Icon>
          )}
          {layout.id === currentId && (
            <Icon clickable={false} xxsmall style={{ opacity: 0.2 }}>
              <DeleteSvg />
            </Icon>
          )}
        </ShowHoverParent>
      </HoverItem>
    ));
  }, [loading, layouts, currentPanelsState, props, deleteLayout]);

  useEffect(() => {
    if (error) {
      sendNotification(error.message, error, "app", "error");
    }
  }, [error]);

  // avoid showing a flash of empty menu while loading
  if (loading) {
    return ReactNull;
  }

  return (
    <Menu>
      {layoutItems}
      <hr style={{ marginTop: "8px", marginBottom: "8px" }} />
      <Item onClick={duplicateLayout}>New</Item>
      <Item onClick={exportToFile}>Export</Item>
      <Item onClick={importFromFile}>Import</Item>
    </Menu>
  );
}
