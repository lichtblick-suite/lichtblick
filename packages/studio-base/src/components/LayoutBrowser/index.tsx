// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { IconButton, Spinner } from "@fluentui/react";
import moment from "moment";
import path from "path";
import { useCallback, useEffect } from "react";
import { useToasts } from "react-toast-notifications";
import { useMountedState } from "react-use";
import useAsyncFn from "react-use/lib/useAsyncFn";
import { v4 as uuidv4 } from "uuid";

import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLayoutCache } from "@foxglove/studio-base/context/LayoutCacheContext";
import welcomeLayout from "@foxglove/studio-base/layouts/welcomeLayout";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { CachedLayout } from "@foxglove/studio-base/services/ILayoutCache";
import { downloadTextFile } from "@foxglove/studio-base/util/download";

import LayoutSection from "./LayoutSection";
import showOpenFilePicker from "./showOpenFilePicker";

export default function LayoutBrowser({
  currentDateForStorybook,
}: React.PropsWithChildren<{
  currentDateForStorybook?: Date;
}>): JSX.Element {
  const isMounted = useMountedState();
  const { addToast } = useToasts();
  const layoutCache = useLayoutCache();

  const currentLayoutId = useCurrentLayoutSelector((state) => state.id);
  const { loadLayout } = useCurrentLayoutActions();

  const [layouts, reloadLayouts] = useAsyncFn(() => layoutCache.list(), [layoutCache], {
    loading: true,
  });

  // Start loading on first mount
  useEffect(() => {
    reloadLayouts();
  }, [reloadLayouts]);

  const onSelectLayout = useCallback(
    async (item: CachedLayout) => {
      const layout = await layoutCache.get(item.id);
      if (layout?.state) {
        loadLayout(layout.state);
      }
    },
    [layoutCache, loadLayout],
  );

  const onRenameLayout = useCallback(
    async (item: CachedLayout, newName: string) => {
      const newState: PanelsState | undefined = item.state
        ? { ...item.state, name: newName }
        : undefined;
      await layoutCache.put({
        ...item,
        name: newName,
        state: newState,
      });
      if (newState && currentLayoutId === item.id) {
        loadLayout(newState);
      }
      reloadLayouts();
    },
    [currentLayoutId, layoutCache, loadLayout, reloadLayouts],
  );

  const onDuplicateLayout = useCallback(
    async (item: CachedLayout) => {
      const newId = uuidv4();
      const newName = `${item.name} copy`;
      const newLayout = {
        ...item,
        id: newId,
        name: newName,
        state: item.state ? { ...item.state, id: newId, name: newName } : undefined,
      };
      await layoutCache.put(newLayout);
      if (newLayout.state) {
        loadLayout(newLayout.state);
      }
      reloadLayouts();
    },
    [layoutCache, loadLayout, reloadLayouts],
  );

  const onDeleteLayout = useCallback(
    async (item: CachedLayout) => {
      await layoutCache.delete(item.id);
      const firstLayout = (await layoutCache.list()).find(
        (layout): layout is typeof layout & { state: PanelsState } => layout.state != undefined,
      );
      if (firstLayout) {
        loadLayout(firstLayout.state);
      } else {
        loadLayout(welcomeLayout);
      }
      reloadLayouts();
    },
    [layoutCache, loadLayout, reloadLayouts],
  );

  const createNewLayout = useCallback(async () => {
    const state: PanelsState = {
      name: `Unnamed layout ${moment(currentDateForStorybook).format("l")} at ${moment(
        currentDateForStorybook,
      ).format("LT")}`,
      id: uuidv4(),
      configById: {},
      globalVariables: {},
      userNodes: {},
      linkedGlobalVariables: [],
      playbackConfig: defaultPlaybackConfig,
    };
    await layoutCache.put({ id: state.id, name: state.name, path: [], state });
    loadLayout(state);
    reloadLayouts();
  }, [currentDateForStorybook, layoutCache, loadLayout, reloadLayouts]);

  const onExportLayout = useCallback((item: CachedLayout) => {
    if (item.state) {
      const name = item.state.name ?? "unnamed layout";
      const content = JSON.stringify(item.state, undefined, 2);
      downloadTextFile(content, `${name}.json`);
    }
  }, []);

  const importLayout = useCallback(async () => {
    const [fileHandle] = await showOpenFilePicker({
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

    if (typeof parsedState !== "object" || !parsedState) {
      addToast(`${file.name} is not a valid layout`, { appearance: "error" });
      return;
    }

    const state = parsedState as PanelsState;
    state.id = uuidv4();
    state.name = layoutName;
    await layoutCache.put({ id: state.id, path: undefined, name: state.name, state });

    loadLayout(state);
    reloadLayouts();
  }, [addToast, isMounted, layoutCache, loadLayout, reloadLayouts]);

  const createLayoutTooltip = useTooltip({ contents: "Create new layout" });
  const importLayoutTooltip = useTooltip({ contents: "Import layout" });

  return (
    <SidebarContent
      title="Layouts"
      noPadding
      trailingItems={[
        layouts.loading && <Spinner />,
        // eslint-disable-next-line react/jsx-key
        <IconButton
          elementRef={createLayoutTooltip.ref}
          iconProps={{ iconName: "Add" }}
          onClick={createNewLayout}
          ariaLabel="Create new layout"
          data-test="add-layout"
        >
          {createLayoutTooltip.tooltip}
        </IconButton>,
        // eslint-disable-next-line react/jsx-key
        <IconButton
          elementRef={importLayoutTooltip.ref}
          iconProps={{ iconName: "OpenFile" }}
          onClick={importLayout}
          ariaLabel="Import layout"
        >
          {importLayoutTooltip.tooltip}
        </IconButton>,
      ]}
    >
      <LayoutSection<CachedLayout>
        items={layouts}
        selectedId={currentLayoutId}
        onSelect={onSelectLayout}
        onRename={onRenameLayout}
        onDuplicate={onDuplicateLayout}
        onDelete={onDeleteLayout}
        onExport={onExportLayout}
      />
    </SidebarContent>
  );
}
