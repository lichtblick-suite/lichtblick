// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";
import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import { useMountedState } from "react-use";
import { v4 as uuidv4 } from "uuid";

import { loadLayout } from "@foxglove-studio/app/actions/panels";
import LayoutIcon from "@foxglove-studio/app/assets/layout.svg";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Flex from "@foxglove-studio/app/components/Flex";
import { WrappedIcon } from "@foxglove-studio/app/components/Icon";
import { Layout, useLayoutStorage } from "@foxglove-studio/app/context/LayoutStorageContext";
import { usePrompt } from "@foxglove-studio/app/hooks/usePrompt";
import { PanelsState } from "@foxglove-studio/app/reducers/panels";
import { downloadTextFile } from "@foxglove-studio/app/util";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

import LayoutsContextMenu from "./LayoutsContextMenu";

// A Wrapper around window.showOpenFilePicker that handles the error thrown on "cancel"
// Why the api is designed this was is beyond me
async function showOpenFilePicker(): Promise<FileSystemFileHandle | undefined> {
  const result = await window
    .showOpenFilePicker({
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
    })
    .catch((err) => {
      if (err.message !== "The user aborted a request.") {
        throw err;
      }
    });

  if (!result) {
    return;
  }

  return result[0];
}

// Show the list of available layouts for user selection
// The context menu is implemented as a separate component to avoid fetching the layout list
// and re-rendering when panel layouts change if the menu is not open
export default function LayoutMenu(props: { isOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(props.isOpen ?? false);
  const prompt = usePrompt();
  const dispatch = useDispatch();
  const isMounted = useMountedState();

  const layoutStorage = useLayoutStorage();

  const renameAction = useCallback(
    async (layout: Layout) => {
      const value = await prompt({
        value: layout.name,
      });
      if (!isMounted()) {
        return;
      }
      if (value !== undefined && value.length > 0 && layout.state) {
        layout.name = value;
        layout.state.name = value;
        dispatch(loadLayout(layout.state));
      }
    },
    [dispatch, isMounted, prompt],
  );

  const exportAction = useCallback((layout: Layout) => {
    const name = layout.name ?? "unnamed";
    const content = JSON.stringify(layout.state, undefined, 2);
    downloadTextFile(content, `${name}.json`);
  }, []);

  const importAction = useCallback(async () => {
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

    dispatch(loadLayout(state));
  }, [dispatch, isMounted]);

  const newAction = useCallback(
    (layout: Layout) => {
      if (layout.state) {
        dispatch(loadLayout(layout.state));
      }
    },
    [dispatch],
  );

  const selectAction = useCallback(
    (layout: Layout) => {
      if (layout.state) {
        dispatch(loadLayout(layout.state));
      }
    },
    [dispatch],
  );

  const deleteLayout = useCallback(
    async (layout: Layout) => {
      await layoutStorage.delete(layout.id);
    },
    [layoutStorage],
  );

  return (
    <ChildToggle position="below" onToggle={setIsOpen} isOpen={isOpen}>
      <Flex>
        <WrappedIcon medium fade active={isOpen} tooltip="Layouts">
          <LayoutIcon />
        </WrappedIcon>
      </Flex>
      <LayoutsContextMenu
        onSelectAction={selectAction}
        onRenameAction={renameAction}
        onNewAction={newAction}
        onExportAction={exportAction}
        onImportAction={importAction}
        onDeleteAction={deleteLayout}
        onClose={() => setIsOpen(false)}
      />
    </ChildToggle>
  );
}
