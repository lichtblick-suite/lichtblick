// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { IconButton, Spinner, Stack } from "@fluentui/react";
import { partition } from "lodash";
import moment from "moment";
import path from "path";
import { useCallback, useEffect } from "react";
import { useToasts } from "react-toast-notifications";
import { useMountedState } from "react-use";
import useAsyncFn from "react-use/lib/useAsyncFn";

import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLayoutStorage } from "@foxglove/studio-base/context/LayoutStorageContext";
import welcomeLayout from "@foxglove/studio-base/layouts/welcomeLayout";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { LayoutMetadata } from "@foxglove/studio-base/services/ILayoutStorage";
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
  const layoutStorage = useLayoutStorage();

  const currentLayoutId = useCurrentLayoutSelector((state) => state.selectedLayout?.id);
  const { setSelectedLayout } = useCurrentLayoutActions();

  const [layouts, reloadLayouts] = useAsyncFn(
    async () => {
      const [personal, shared] = partition(
        await layoutStorage.getLayouts(),
        layoutStorage.supportsSharing
          ? (layout) => layout.permission === "creator_write"
          : () => true,
      );
      return { personal, shared };
    },
    [layoutStorage],
    { loading: true },
  );

  // Start loading on first mount
  useEffect(() => {
    reloadLayouts();
  }, [reloadLayouts]);

  const onSelectLayout = useCallback(
    async (item: LayoutMetadata) => {
      const layout = await layoutStorage.getLayout(item.id);
      if (layout) {
        setSelectedLayout(layout);
      }
    },
    [layoutStorage, setSelectedLayout],
  );

  const onRenameLayout = useCallback(
    async (item: LayoutMetadata, newName: string) => {
      await layoutStorage.renameLayout({ id: item.id, path: [], name: newName });
      if (currentLayoutId === item.id) {
        await onSelectLayout(item);
      }
      await reloadLayouts();
    },
    [currentLayoutId, layoutStorage, onSelectLayout, reloadLayouts],
  );

  const onDuplicateLayout = useCallback(
    async (item: LayoutMetadata) => {
      const source = await layoutStorage.getLayout(item.id);
      if (source) {
        const newLayout = await layoutStorage.saveNewLayout({
          path: [],
          name: `${item.name} copy`,
          data: source.data,
        });
        await onSelectLayout(newLayout);
      }
      await reloadLayouts();
    },
    [layoutStorage, onSelectLayout, reloadLayouts],
  );

  const onDeleteLayout = useCallback(
    async (item: LayoutMetadata) => {
      await layoutStorage.deleteLayout({ id: item.id });
      try {
        if (currentLayoutId !== item.id) {
          return;
        }
        // If the layout was selected, select a different available layout
        for (const { id } of await layoutStorage.getLayouts()) {
          const layout = await layoutStorage.getLayout(id);
          if (layout) {
            setSelectedLayout(layout);
            return;
          }
        }
        // If no existing layout could be selected, use the welcome layout
        const newLayout = await layoutStorage.saveNewLayout({
          path: [],
          name: welcomeLayout.name,
          data: welcomeLayout.data,
        });
        await onSelectLayout(newLayout);
      } finally {
        await reloadLayouts();
      }
    },
    [currentLayoutId, layoutStorage, setSelectedLayout, onSelectLayout, reloadLayouts],
  );

  const createNewLayout = useCallback(async () => {
    const name = `Unnamed layout ${moment(currentDateForStorybook).format("l")} at ${moment(
      currentDateForStorybook,
    ).format("LT")}`;
    const state: Omit<PanelsState, "name" | "id"> = {
      configById: {},
      globalVariables: {},
      userNodes: {},
      linkedGlobalVariables: [],
      playbackConfig: defaultPlaybackConfig,
    };
    const newLayout = await layoutStorage.saveNewLayout({
      name,
      path: [],
      data: state as PanelsState,
    });
    onSelectLayout(newLayout);
    reloadLayouts();
  }, [currentDateForStorybook, layoutStorage, onSelectLayout, reloadLayouts]);

  const onExportLayout = useCallback(
    async (item: LayoutMetadata) => {
      const layout = await layoutStorage.getLayout(item.id);
      if (layout) {
        const content = JSON.stringify(layout.data, undefined, 2);
        downloadTextFile(content, `${item.name}.json`);
      }
    },
    [layoutStorage],
  );

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

    const data = parsedState as PanelsState;
    const newLayout = await layoutStorage.saveNewLayout({ path: [], name: layoutName, data });
    onSelectLayout(newLayout);
    reloadLayouts();
  }, [addToast, isMounted, layoutStorage, onSelectLayout, reloadLayouts]);

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
      <Stack verticalFill>
        <Stack.Item>
          <LayoutSection
            title={layoutStorage.supportsSharing ? "Personal" : undefined}
            emptyText="Add a new layout to get started with Foxglove Studio!"
            items={layouts.value?.personal}
            selectedId={currentLayoutId}
            onSelect={onSelectLayout}
            onRename={onRenameLayout}
            onDuplicate={onDuplicateLayout}
            onDelete={onDeleteLayout}
            onExport={onExportLayout}
          />
        </Stack.Item>
        <Stack.Item>
          {layoutStorage.supportsSharing && (
            <LayoutSection
              title="Shared"
              emptyText="Your organization doesn’t have any shared layouts yet. Share a personal layout to collaborate with other team members."
              items={layouts.value?.shared}
              selectedId={currentLayoutId}
              onSelect={onSelectLayout}
              onRename={onRenameLayout}
              onDuplicate={onDuplicateLayout}
              onDelete={onDeleteLayout}
              onExport={onExportLayout}
            />
          )}
        </Stack.Item>
        <div style={{ flexGrow: 1 }} />
      </Stack>
    </SidebarContent>
  );
}
