// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  DefaultButton,
  IconButton,
  Link,
  makeStyles,
  Spinner,
  Stack,
  useTheme,
} from "@fluentui/react";
import { partition } from "lodash";
import moment from "moment";
import path from "path";
import { useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import { useToasts } from "react-toast-notifications";
import { useMountedState } from "react-use";
import useAsyncFn from "react-use/lib/useAsyncFn";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import useCallbackWithToast from "@foxglove/studio-base/hooks/useCallbackWithToast";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";
import { usePrompt } from "@foxglove/studio-base/hooks/usePrompt";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { Layout, layoutIsShared } from "@foxglove/studio-base/services/ILayoutStorage";
import { downloadTextFile } from "@foxglove/studio-base/util/download";

import LayoutSection from "./LayoutSection";
import showOpenFilePicker from "./showOpenFilePicker";
import { debugBorder } from "./styles";

const useStyles = makeStyles((theme) => ({
  signInPrompt: {
    fontSize: theme.fonts.smallPlus.fontSize,
    padding: theme.spacing.s1,
    backgroundColor: theme.palette.themeLighterAlt,
    position: "sticky",
    bottom: 0,
  },
}));

export default function LayoutBrowser({
  currentDateForStorybook,
}: React.PropsWithChildren<{
  currentDateForStorybook?: Date;
}>): JSX.Element {
  const theme = useTheme();
  const isMounted = useMountedState();
  const { addToast } = useToasts();
  const layoutManager = useLayoutManager();
  const prompt = usePrompt();
  const analytics = useAnalytics();
  const confirm = useConfirm();
  const { openAccountSettings } = useWorkspace();
  const styles = useStyles();

  const currentLayoutId = useCurrentLayoutSelector((state) => state.selectedLayout?.id);
  const { setSelectedLayoutId } = useCurrentLayoutActions();

  const [isBusy, setIsBusy] = useState(layoutManager.isBusy);
  useLayoutEffect(() => {
    const listener = () => setIsBusy(layoutManager.isBusy);
    listener();
    layoutManager.on("busychange", listener);
    return () => layoutManager.off("busychange", listener);
  }, [layoutManager]);

  const [layouts, reloadLayouts] = useAsyncFn(
    async () => {
      const [shared, personal] = partition(
        await layoutManager.getLayouts(),
        layoutManager.supportsSharing ? layoutIsShared : () => false,
      );
      return {
        personal: personal.sort((a, b) => a.name.localeCompare(b.name)),
        shared: shared.sort((a, b) => a.name.localeCompare(b.name)),
      };
    },
    [layoutManager],
    { loading: true },
  );

  useEffect(() => {
    const listener = () => void reloadLayouts();
    layoutManager.on("change", listener);
    return () => layoutManager.off("change", listener);
  }, [layoutManager, reloadLayouts]);

  // Start loading on first mount
  useEffect(() => {
    void reloadLayouts();
  }, [reloadLayouts]);

  const promptForUnsavedChanges = useCallback(async () => {
    // Don't allow the user to switch away from a personal layout if they have unsaved changes. This
    // currently has a race condition because of the throttled save in CurrentLayoutProvider -- it's
    // possible to make changes and switch layouts before they're sent to the layout manager.
    const currentLayout =
      currentLayoutId != undefined ? await layoutManager.getLayout(currentLayoutId) : undefined;
    if (
      currentLayout != undefined &&
      layoutIsShared(currentLayout) &&
      currentLayout.working != undefined
    ) {
      await confirm({
        title: `“${currentLayout.name}” has been modified`,
        prompt: "Save or discard your changes before switching layouts.",
        ok: "Fine",
        cancel: "Do Not Sell My Personal Information",
      });
      return false;
    }
    return true;
  }, [confirm, currentLayoutId, layoutManager]);

  const onSelectLayout = useCallbackWithToast(
    async (item: Layout, selectedViaClick?: boolean) => {
      if (selectedViaClick === true) {
        if (!(await promptForUnsavedChanges())) {
          return;
        }
        void analytics.logEvent(AppEvent.LAYOUT_SELECT, { permission: item.permission });
      }
      setSelectedLayoutId(item.id);
    },
    [analytics, promptForUnsavedChanges, setSelectedLayoutId],
  );

  const onRenameLayout = useCallbackWithToast(
    async (item: Layout, newName: string) => {
      await layoutManager.updateLayout({ id: item.id, name: newName });
      void analytics.logEvent(AppEvent.LAYOUT_RENAME, { permission: item.permission });
    },
    [analytics, layoutManager],
  );

  const onDuplicateLayout = useCallbackWithToast(
    async (item: Layout) => {
      if (!(await promptForUnsavedChanges())) {
        return;
      }
      const newLayout = await layoutManager.saveNewLayout({
        name: `${item.name} copy`,
        data: item.working?.data ?? item.baseline.data,
        permission: "creator_write",
      });
      await onSelectLayout(newLayout);
      void analytics.logEvent(AppEvent.LAYOUT_DUPLICATE, { permission: item.permission });
    },
    [analytics, layoutManager, onSelectLayout, promptForUnsavedChanges],
  );

  const onDeleteLayout = useCallbackWithToast(
    async (item: Layout) => {
      await layoutManager.deleteLayout({ id: item.id });
      void analytics.logEvent(AppEvent.LAYOUT_DELETE, { permission: item.permission });

      if (currentLayoutId !== item.id) {
        return;
      }
      // If the layout was selected, select a different available layout
      for (const layout of await layoutManager.getLayouts()) {
        setSelectedLayoutId(layout.id);
        return;
      }
      // If no other layouts exist, just deselect the layout
      setSelectedLayoutId(undefined);
    },
    [analytics, currentLayoutId, layoutManager, setSelectedLayoutId],
  );

  const createNewLayout = useCallbackWithToast(async () => {
    if (!(await promptForUnsavedChanges())) {
      return;
    }
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
    const newLayout = await layoutManager.saveNewLayout({
      name,
      data: state as PanelsState,
      permission: "creator_write",
    });
    void onSelectLayout(newLayout);

    void analytics.logEvent(AppEvent.LAYOUT_CREATE);
  }, [promptForUnsavedChanges, currentDateForStorybook, layoutManager, onSelectLayout, analytics]);

  const onExportLayout = useCallbackWithToast(
    async (item: Layout) => {
      const content = JSON.stringify(item.working?.data ?? item.baseline.data, undefined, 2);
      downloadTextFile(content, `${item.name}.json`);
      void analytics.logEvent(AppEvent.LAYOUT_EXPORT, { permission: item.permission });
    },
    [analytics],
  );

  const onShareLayout = useCallbackWithToast(
    async (item: Layout) => {
      const name = await prompt({
        title: "Share a copy with your team",
        subText: "Team layouts can be used and changed by members of your team.",
        initialValue: item.name,
        label: "Layout name",
      });
      if (name != undefined) {
        await layoutManager.saveNewLayout({
          name,
          data: item.working?.data ?? item.baseline.data,
          permission: "org_write",
        });
        void analytics.logEvent(AppEvent.LAYOUT_SHARE, { permission: item.permission });
      }
    },
    [analytics, layoutManager, prompt],
  );

  const onOverwriteLayout = useCallbackWithToast(
    async (item: Layout) => {
      // CurrentLayoutProvider automatically updates in its layout change listener
      await layoutManager.overwriteLayout({ id: item.id });
      void analytics.logEvent(AppEvent.LAYOUT_OVERWRITE, { permission: item.permission });
    },
    [analytics, layoutManager],
  );

  const onRevertLayout = useCallbackWithToast(
    async (item: Layout) => {
      // CurrentLayoutProvider automatically updates in its layout change listener
      await layoutManager.revertLayout({ id: item.id });
      void analytics.logEvent(AppEvent.LAYOUT_REVERT, { permission: item.permission });
    },
    [analytics, layoutManager],
  );

  const onMakePersonalCopy = useCallbackWithToast(
    async (item: Layout) => {
      const newLayout = await layoutManager.makePersonalCopy({
        id: item.id,
        name: `${item.name} copy`,
      });
      await onSelectLayout(newLayout);
      void analytics.logEvent(AppEvent.LAYOUT_MAKE_PERSONAL_COPY, {
        permission: item.permission,
        syncStatus: item.syncInfo?.status,
      });
    },
    [analytics, layoutManager, onSelectLayout],
  );

  const importLayout = useCallbackWithToast(async () => {
    if (!(await promptForUnsavedChanges())) {
      return;
    }
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
    const newLayout = await layoutManager.saveNewLayout({
      name: layoutName,
      data,
      permission: "creator_write",
    });
    void onSelectLayout(newLayout);
    void analytics.logEvent(AppEvent.LAYOUT_IMPORT);
  }, [promptForUnsavedChanges, isMounted, layoutManager, onSelectLayout, analytics, addToast]);

  const createLayoutTooltip = useTooltip({ contents: "Create new layout" });
  const importLayoutTooltip = useTooltip({ contents: "Import layout" });

  const layoutDebug = useContext(LayoutStorageDebuggingContext);

  const [enableSharedLayouts = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_CONSOLE_API_LAYOUTS,
  );
  const showSignInPrompt = enableSharedLayouts && !layoutManager.supportsSharing;

  return (
    <SidebarContent
      title="Layouts"
      noPadding
      trailingItems={[
        (layouts.loading || isBusy) && <Spinner key="spinner" />,
        <IconButton
          key="add-layout"
          elementRef={createLayoutTooltip.ref}
          iconProps={{ iconName: "Add" }}
          onClick={createNewLayout}
          ariaLabel="Create new layout"
          data-test="add-layout"
          styles={{
            icon: {
              height: 20,
            },
            root: {
              margin: `0 ${theme.spacing.s2}`,
            },
          }}
        >
          {createLayoutTooltip.tooltip}
        </IconButton>,
        <IconButton
          key="import-layout"
          elementRef={importLayoutTooltip.ref}
          iconProps={{ iconName: "OpenFile" }}
          onClick={importLayout}
          ariaLabel="Import layout"
          styles={{
            root: {
              marginRight: `-${theme.spacing.s1}`,
            },
            icon: {
              height: 20,
            },
          }}
        >
          {importLayoutTooltip.tooltip}
        </IconButton>,
      ]}
    >
      <Stack verticalFill>
        <Stack.Item>
          <LayoutSection
            title={layoutManager.supportsSharing ? "Personal" : undefined}
            emptyText="Add a new layout to get started with Foxglove Studio!"
            items={layouts.value?.personal}
            selectedId={currentLayoutId}
            onSelect={onSelectLayout}
            onRename={onRenameLayout}
            onDuplicate={onDuplicateLayout}
            onDelete={onDeleteLayout}
            onShare={onShareLayout}
            onExport={onExportLayout}
            onOverwrite={onOverwriteLayout}
            onRevert={onRevertLayout}
            onMakePersonalCopy={onMakePersonalCopy}
          />
        </Stack.Item>
        <Stack.Item>
          {layoutManager.supportsSharing && (
            <LayoutSection
              title="Team"
              emptyText="Your organization doesn’t have any shared layouts yet. Share a personal layout to collaborate with other team members."
              items={layouts.value?.shared}
              selectedId={currentLayoutId}
              onSelect={onSelectLayout}
              onRename={onRenameLayout}
              onDuplicate={onDuplicateLayout}
              onDelete={onDeleteLayout}
              onShare={onShareLayout}
              onExport={onExportLayout}
              onOverwrite={onOverwriteLayout}
              onRevert={onRevertLayout}
              onMakePersonalCopy={onMakePersonalCopy}
            />
          )}
        </Stack.Item>
        <div style={{ flexGrow: 1 }} />
        {showSignInPrompt && (
          <Stack.Item className={styles.signInPrompt}>
            <Link onClick={openAccountSettings}>Sign in</Link> to sync layouts across multiple
            devices, and share them with team members.
          </Stack.Item>
        )}
        {layoutDebug?.syncNow && (
          <Stack
            styles={{
              root: {
                position: "sticky",
                bottom: 0,
                left: 0,
                right: 0,
                background: theme.semanticColors.bodyBackground,
                padding: theme.spacing.s1,
                ...debugBorder,
              },
            }}
            tokens={{ childrenGap: theme.spacing.s1 }}
          >
            <Stack.Item grow align="stretch">
              <Stack disableShrink horizontal tokens={{ childrenGap: theme.spacing.s1 }}>
                <Stack.Item grow>
                  <DefaultButton
                    text="Sync now"
                    onClick={async () => {
                      await layoutDebug.syncNow?.();
                      await reloadLayouts();
                    }}
                    styles={{
                      root: {
                        display: "block",
                        width: "100%",
                        margin: 0,
                      },
                    }}
                  />
                </Stack.Item>
              </Stack>
            </Stack.Item>
          </Stack>
        )}
      </Stack>
    </SidebarContent>
  );
}
