// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ActionButton,
  ContextualMenuItemType,
  IButton,
  IContextualMenuItem,
} from "@fluentui/react";
import path from "path";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useAsyncFn, useMountedState } from "react-use";
import { v4 as uuidv4 } from "uuid";

import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLocalLayoutStorage } from "@foxglove/studio-base/context/LocalLayoutStorageContext";
import useLatestNonNull from "@foxglove/studio-base/hooks/useLatestNonNull";
import { usePrompt } from "@foxglove/studio-base/hooks/usePrompt";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { LocalLayout } from "@foxglove/studio-base/services/LocalLayoutStorage";
import { downloadTextFile } from "@foxglove/studio-base/util/download";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

// A Wrapper around window.showOpenFilePicker that handles the error thrown on "cancel"
// Why the api is designed this was is beyond me
async function showOpenFilePicker(): Promise<FileSystemFileHandle | undefined> {
  try {
    const result = await window.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: false,
      types: [
        {
          description: "JSON Files",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });
    return result?.[0];
  } catch (err) {
    if (err.name === "AbortError") {
      return;
    }
    throw err;
  }
}

// Show the list of available layouts for user selection
export default function LayoutMenu({
  defaultIsOpen = false,
}: {
  defaultIsOpen?: boolean;
}): React.ReactElement {
  const prompt = usePrompt();
  const isMounted = useMountedState();
  const buttonRef = useRef<IButton>(ReactNull);
  useLayoutEffect(() => {
    if (defaultIsOpen) {
      buttonRef.current?.openMenu();
    }
  }, [defaultIsOpen]);

  const { getCurrentLayout, loadLayout } = useCurrentLayoutActions();
  const layoutStorage = useLocalLayoutStorage();

  // a basic stale-while-revalidate pattern to avoid flicker of layout menu when we reload the layout list
  // When we re-visit local/remote layouts we will want to look at something like swr (https://swr.vercel.app/)
  // that will handle this and other nice things for us.
  const [{ value: asyncLayouts, error, loading }, fetchLayouts] = useAsyncFn(async () => {
    const list = await layoutStorage.list();
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [layoutStorage]);

  const layouts = useLatestNonNull(asyncLayouts);

  useEffect(() => {
    if (error) {
      sendNotification(error.message, error, "app", "error");
    }
  }, [error]);

  const renameAction = useCallback(
    async (layout: LocalLayout) => {
      const value = await prompt({
        title: "Rename layout",
        value: layout.name,
      });
      if (!isMounted()) {
        return;
      }
      if (value !== undefined && value.length > 0 && layout.state) {
        layout.name = value;
        layout.state.name = value;
        loadLayout(layout.state);
      }
    },
    [loadLayout, isMounted, prompt],
  );

  const exportAction = useCallback(() => {
    const currentPanelsState = getCurrentLayout();
    const name = currentPanelsState.name ?? "unnamed";
    const content = JSON.stringify(currentPanelsState, undefined, 2);
    downloadTextFile(content, `${name}.json`);
  }, [getCurrentLayout]);

  const importAction = useCallback<() => void>(async () => {
    const fileHandle = await showOpenFilePicker();
    if (!fileHandle) {
      return;
    }

    const file = await fileHandle.getFile();
    const layoutName = path.basename(file.name, path.extname(file.name));
    const content = await file.text();
    const parsedState: unknown = JSON.parse(content);

    if (!isMounted()) {
      return;
    }

    if (typeof parsedState !== "object") {
      sendNotification(`${file} is not a valid layout`, Error, "user", "error");
      return;
    }

    const state = parsedState as PanelsState;
    state.id = uuidv4();
    state.name = layoutName;
    await layoutStorage.put({ id: state.id, name: state.name, state });

    loadLayout(state);
  }, [isMounted, layoutStorage, loadLayout]);

  const selectAction = useCallback(
    (layout: LocalLayout) => {
      if (layout.state) {
        loadLayout(layout.state);
      }
    },
    [loadLayout],
  );

  const deleteLayout = useCallback(
    async (layout: LocalLayout) => {
      await layoutStorage.delete(layout.id);
      fetchLayouts();
    },
    [layoutStorage, fetchLayouts],
  );

  const newEmptyLayout = useCallback(() => {
    const name = "empty layout";
    const id = uuidv4();

    const newState: PanelsState = {
      id: id,
      name: name,
      globalVariables: {},
      layout: undefined,
      linkedGlobalVariables: [],
      playbackConfig: defaultPlaybackConfig,
      configById: {},
      userNodes: {},
    };

    loadLayout(newState);
  }, [loadLayout]);

  const duplicateLayout = useCallback(() => {
    const currentPanelsState = getCurrentLayout();
    const name = `${currentPanelsState.name ?? "unnamed"} copy`;
    const id = uuidv4();

    const newState: PanelsState = {
      ...currentPanelsState,
      id: id,
      name: name,
    };

    loadLayout(newState);
  }, [loadLayout, getCurrentLayout]);

  const layoutItems: IContextualMenuItem[] = useMemo(() => {
    if (loading || layouts === undefined) {
      return [];
    }
    const currentLayout = getCurrentLayout();

    // Panel state may not have an ID yet. To make highlighting current layout work we need the ID.
    // Here we set one locally until the currentPanelState has one
    // const currentId = currentPanelsState.id ?? uuidv4();
    // currentPanelsState.id = currentId;

    // current panel state is not in our storage layouts list - this happens after creating a new
    // layout since useLayoutStorage does not subscribe to updates when layouts are added.
    if (
      currentLayout.id != undefined &&
      !layouts.some((layout) => layout.id === currentLayout.id)
    ) {
      layouts.push({
        id: currentLayout.id,
        name: currentLayout.name ?? "unnamed",
        state: currentLayout,
      });
    }

    return layouts.map(
      (layout, idx): IContextualMenuItem => ({
        key: `layout${idx}`,
        text: layout.name,
        split: true,
        onClick: () => {
          if (layout.id !== currentLayout.id) {
            selectAction(layout);
          }
        },
        iconProps: layout.id === currentLayout.id ? { iconName: "CheckMark" } : undefined,
        subMenuProps: {
          items: [
            {
              key: "rename",
              text: "Rename",
              iconProps: { iconName: "Edit" },
              onClick: () => void renameAction(layout),
            },
            {
              key: "delete",
              text: "Delete",
              iconProps: { iconName: "Delete" },
              // delete only available for non-current layouts to avoid "what happens when I delete last layout"
              disabled: layout.id === currentLayout.id,
              onClick: (event) => {
                // Leave the menu open on delete but reload the menu items.
                // This gives visual feedback to the user that their action worked.
                // Also allows them to delete another item, to delete multiple, without re-opening the menu.
                event?.preventDefault();
                deleteLayout(layout);
              },
            },
          ],
        },
      }),
    );
  }, [loading, layouts, renameAction, selectAction, deleteLayout, getCurrentLayout]);

  const items: IContextualMenuItem[] = [
    ...layoutItems,
    { key: "divider_1", itemType: ContextualMenuItemType.Divider },
    { key: "new", text: "New", onClick: newEmptyLayout, iconProps: { iconName: "Add" } },
    {
      key: "duplicate",
      text: "Duplicate",
      onClick: duplicateLayout,
      iconProps: { iconName: "Copy" },
    },
    { key: "export", text: "Export", onClick: exportAction, iconProps: { iconName: "Share" } },
    { key: "import", text: "Import", onClick: importAction, iconProps: { iconName: "OpenFile" } },
  ];

  return (
    <ActionButton
      componentRef={buttonRef}
      iconProps={{
        iconName: "FiveTileGrid",
        styles: { root: { "& span": { verticalAlign: "baseline" } } },
      }}
      menuProps={{ items, onMenuOpened: () => fetchLayouts() }}
      onRenderMenuIcon={() => ReactNull}
    />
  );
}
