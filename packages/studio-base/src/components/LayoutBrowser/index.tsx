// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import FileOpenOutlinedIcon from "@mui/icons-material/FileOpenOutlined";
import {
  Button,
  IconButton,
  Switch,
  FormGroup,
  FormControlLabel,
  CircularProgress,
  useTheme,
} from "@mui/material";
import { partition } from "lodash";
import moment from "moment";
import path from "path";
import { MouseEvent, useCallback, useContext, useEffect, useLayoutEffect } from "react";
import { useToasts } from "react-toast-notifications";
import { useMountedState } from "react-use";
import useAsyncFn from "react-use/lib/useAsyncFn";

import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import SignInPrompt from "@foxglove/studio-base/components/LayoutBrowser/SignInPrompt";
import { useUnsavedChangesPrompt } from "@foxglove/studio-base/components/LayoutBrowser/UnsavedChangesPrompt";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import useCallbackWithToast from "@foxglove/studio-base/hooks/useCallbackWithToast";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";
import { usePrompt } from "@foxglove/studio-base/hooks/usePrompt";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { Layout, LayoutID, layoutIsShared } from "@foxglove/studio-base/services/ILayoutStorage";
import { downloadTextFile } from "@foxglove/studio-base/util/download";
import showOpenFilePicker from "@foxglove/studio-base/util/showOpenFilePicker";

import LayoutSection from "./LayoutSection";
import helpContent from "./index.help.md";
import { useLayoutBrowserReducer } from "./reducer";
import { debugBorder } from "./styles";

const log = Logger.getLogger(__filename);

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

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
  const { unsavedChangesPrompt, openUnsavedChangesPrompt } = useUnsavedChangesPrompt();

  const currentLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
  const { setSelectedLayoutId } = useCurrentLayoutActions();

  const [state, dispatch] = useLayoutBrowserReducer({
    busy: layoutManager.isBusy,
    error: layoutManager.error,
    online: layoutManager.isOnline,
  });

  useLayoutEffect(() => {
    const busyListener = () => {
      dispatch({ type: "set-busy", value: layoutManager.isBusy });
    };
    const onlineListener = () => dispatch({ type: "set-online", value: layoutManager.isOnline });
    const errorListener = () => dispatch({ type: "set-error", value: layoutManager.error });
    busyListener();
    onlineListener();
    errorListener();
    layoutManager.on("busychange", busyListener);
    layoutManager.on("onlinechange", onlineListener);
    layoutManager.on("errorchange", errorListener);
    return () => {
      layoutManager.off("busychange", busyListener);
      layoutManager.off("onlinechange", onlineListener);
      layoutManager.off("errorchange", errorListener);
    };
  }, [dispatch, layoutManager]);

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
    const processAction = async () => {
      if (!state.multiAction) {
        return;
      }

      const id = state.multiAction.ids[0];
      if (id) {
        try {
          switch (state.multiAction.action) {
            case "delete":
              await layoutManager.deleteLayout({ id: id as LayoutID });
              dispatch({ type: "shift-multi-action" });
              break;
          }
        } catch (err) {
          addToast(`Error deleting layouts: ${err.message}`, { appearance: "error" });
          dispatch({ type: "clear-multi-action" });
        }
      }
    };

    processAction().catch((err) => log.error(err));
  }, [addToast, dispatch, layoutManager, state.multiAction]);

  useEffect(() => {
    const listener = () => void reloadLayouts();
    layoutManager.on("change", listener);
    return () => layoutManager.off("change", listener);
  }, [layoutManager, reloadLayouts]);

  // Start loading on first mount
  useEffect(() => {
    reloadLayouts().catch((err) => log.error(err));
  }, [reloadLayouts]);

  /**
   * Don't allow the user to switch away from a personal layout if they have unsaved changes. This
   * currently has a race condition because of the throttled save in CurrentLayoutProvider -- it's
   * possible to make changes and switch layouts before they're sent to the layout manager.
   * @returns true if the original action should continue, false otherwise
   */
  const promptForUnsavedChanges = useCallback(async () => {
    const currentLayout =
      currentLayoutId != undefined ? await layoutManager.getLayout(currentLayoutId) : undefined;
    if (
      currentLayout != undefined &&
      layoutIsShared(currentLayout) &&
      currentLayout.working != undefined
    ) {
      const result = await openUnsavedChangesPrompt(currentLayout);
      switch (result.type) {
        case "cancel":
          return false;
        case "discard":
          await layoutManager.revertLayout({ id: currentLayout.id });
          void analytics.logEvent(AppEvent.LAYOUT_REVERT, {
            permission: currentLayout.permission,
            context: "UnsavedChangesPrompt",
          });
          return true;
        case "overwrite":
          await layoutManager.overwriteLayout({ id: currentLayout.id });
          void analytics.logEvent(AppEvent.LAYOUT_OVERWRITE, {
            permission: currentLayout.permission,
            context: "UnsavedChangesPrompt",
          });
          return true;
        case "makePersonal":
          // We don't use onMakePersonalCopy() here because it might need to prompt for unsaved changes, and we don't want to select the newly created layout
          await layoutManager.makePersonalCopy({
            id: currentLayout.id,
            name: result.name,
          });
          void analytics.logEvent(AppEvent.LAYOUT_MAKE_PERSONAL_COPY, {
            permission: currentLayout.permission,
            syncStatus: currentLayout.syncInfo?.status,
            context: "UnsavedChangesPrompt",
          });
          return true;
      }
    }
    return true;
  }, [analytics, currentLayoutId, layoutManager, openUnsavedChangesPrompt]);

  const onSelectLayout = useCallbackWithToast(
    async (
      item: Layout,
      { selectedViaClick = false, event }: { selectedViaClick?: boolean; event?: MouseEvent } = {},
    ) => {
      if (selectedViaClick) {
        if (!(await promptForUnsavedChanges())) {
          return;
        }
        void analytics.logEvent(AppEvent.LAYOUT_SELECT, { permission: item.permission });
      }
      if (event?.ctrlKey === true || event?.metaKey === true || event?.shiftKey === true) {
        if (item.id !== currentLayoutId) {
          dispatch({
            type: "select-id",
            id: item.id,
            layouts: layouts.value,
            modKey: event.ctrlKey || event.metaKey,
            shiftKey: event.shiftKey,
          });
        }
      } else {
        setSelectedLayoutId(item.id);
        dispatch({ type: "select-id", id: item.id });
      }
    },
    [
      analytics,
      currentLayoutId,
      dispatch,
      layouts.value,
      promptForUnsavedChanges,
      setSelectedLayoutId,
    ],
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
        permission: "CREATOR_WRITE",
      });
      await onSelectLayout(newLayout);
      void analytics.logEvent(AppEvent.LAYOUT_DUPLICATE, { permission: item.permission });
    },
    [analytics, layoutManager, onSelectLayout, promptForUnsavedChanges],
  );

  const onDeleteLayout = useCallbackWithToast(
    async (item: Layout) => {
      if (state.selectedIds.length > 0) {
        dispatch({ type: "queue-multi-action", action: "delete" });
        return;
      }

      void analytics.logEvent(AppEvent.LAYOUT_DELETE, { permission: item.permission });

      // If the layout was selected, select a different available layout.
      //
      // When a users current layout is deleted, we display a notice. By selecting a new layout
      // before deleting their current layout we avoid the weirdness of displaying a notice that the
      // user just deleted their current layout which is somewhat obvious to the user.
      if (currentLayoutId === item.id) {
        const storedLayouts = await layoutManager.getLayouts();
        const targetLayout = storedLayouts.find((layout) => layout.id !== currentLayoutId);
        setSelectedLayoutId(targetLayout?.id);
        dispatch({ type: "select-id", id: targetLayout?.id });
      }
      await layoutManager.deleteLayout({ id: item.id });
    },
    [
      analytics,
      currentLayoutId,
      dispatch,
      layoutManager,
      setSelectedLayoutId,
      state.selectedIds.length,
    ],
  );

  const createNewLayout = useCallbackWithToast(async () => {
    if (!(await promptForUnsavedChanges())) {
      return;
    }
    const name = `Unnamed layout ${moment(currentDateForStorybook).format("l")} at ${moment(
      currentDateForStorybook,
    ).format("LT")}`;
    const panelState: Omit<PanelsState, "name" | "id"> = {
      configById: {},
      globalVariables: {},
      userNodes: {},
      linkedGlobalVariables: [],
      playbackConfig: defaultPlaybackConfig,
    };
    const newLayout = await layoutManager.saveNewLayout({
      name,
      data: panelState as PanelsState,
      permission: "CREATOR_WRITE",
    });
    void onSelectLayout(newLayout);

    void analytics.logEvent(AppEvent.LAYOUT_CREATE);
  }, [promptForUnsavedChanges, currentDateForStorybook, layoutManager, onSelectLayout, analytics]);

  const onExportLayout = useCallbackWithToast(
    async (item: Layout) => {
      const content = JSON.stringify(item.working?.data ?? item.baseline.data, undefined, 2) ?? "";
      downloadTextFile(content, `${item.name}.json`);
      void analytics.logEvent(AppEvent.LAYOUT_EXPORT, { permission: item.permission });
    },
    [analytics],
  );

  const onShareLayout = useCallbackWithToast(
    async (item: Layout) => {
      const name = await prompt({
        title: "Share a copy with your team",
        subText: "Team layouts can be used and changed by other members of your team.",
        initialValue: item.name,
        label: "Layout name",
      });
      if (name != undefined) {
        const newLayout = await layoutManager.saveNewLayout({
          name,
          data: item.working?.data ?? item.baseline.data,
          permission: "ORG_WRITE",
        });
        void analytics.logEvent(AppEvent.LAYOUT_SHARE, { permission: item.permission });
        await onSelectLayout(newLayout);
      }
    },
    [analytics, layoutManager, onSelectLayout, prompt],
  );

  const onOverwriteLayout = useCallbackWithToast(
    async (item: Layout) => {
      if (layoutIsShared(item)) {
        const response = await confirm({
          title: `Update “${item.name}”?`,
          prompt:
            "Your changes will overwrite this layout for all team members. This cannot be undone.",
          ok: "Save",
        });
        if (response !== "ok") {
          return;
        }
      }
      await layoutManager.overwriteLayout({ id: item.id });
      void analytics.logEvent(AppEvent.LAYOUT_OVERWRITE, { permission: item.permission });
    },
    [analytics, confirm, layoutManager],
  );

  const onRevertLayout = useCallbackWithToast(
    async (item: Layout) => {
      const response = await confirm({
        title: `Revert “${item.name}”?`,
        prompt: "Your changes will be permantly deleted. This cannot be undone.",
        ok: "Discard changes",
        variant: "danger",
      });
      if (response !== "ok") {
        return;
      }
      await layoutManager.revertLayout({ id: item.id });
      void analytics.logEvent(AppEvent.LAYOUT_REVERT, { permission: item.permission });
    },
    [analytics, confirm, layoutManager],
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
    const fileHandles = await showOpenFilePicker({
      multiple: true,
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
    if (fileHandles.length === 0) {
      return;
    }

    const newLayouts = await Promise.all(
      fileHandles.map(async (fileHandle) => {
        const file = await fileHandle.getFile();
        const layoutName = path.basename(file.name, path.extname(file.name));
        const content = await file.text();

        if (!isMounted()) {
          return;
        }

        let parsedState: unknown;
        try {
          parsedState = JSON.parse(content);
        } catch (err) {
          addToast(`${file.name} is not a valid layout: ${err.message}`, { appearance: "error" });
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
          permission: "CREATOR_WRITE",
        });
        return newLayout;
      }),
    );

    if (!isMounted()) {
      return;
    }
    const newLayout = newLayouts.find((layout) => layout != undefined);
    if (newLayout) {
      void onSelectLayout(newLayout);
    }
    void analytics.logEvent(AppEvent.LAYOUT_IMPORT, { numLayouts: fileHandles.length });
  }, [promptForUnsavedChanges, isMounted, layoutManager, onSelectLayout, analytics, addToast]);

  const layoutDebug = useContext(LayoutStorageDebuggingContext);
  const supportsSignIn = useContext(ConsoleApiContext) != undefined;

  const [hideSignInPrompt = false, setHideSignInPrompt] = useAppConfigurationValue<boolean>(
    AppSetting.HIDE_SIGN_IN_PROMPT,
  );

  const showSignInPrompt = supportsSignIn && !layoutManager.supportsSharing && !hideSignInPrompt;

  const pendingMultiAction = state.multiAction?.ids != undefined;

  return (
    <SidebarContent
      title="Layouts"
      helpContent={helpContent}
      disablePadding
      trailingItems={[
        (layouts.loading || state.busy || pendingMultiAction) && (
          <Stack key="loading" alignItems="center" justifyContent="center" padding={1}>
            <CircularProgress size={18} variant="indeterminate" />
          </Stack>
        ),
        (!state.online || state.error != undefined) && (
          <IconButton color="primary" key="offline" disabled title="Offline">
            <CloudOffIcon />
          </IconButton>
        ),
        <IconButton
          color="primary"
          key="add-layout"
          onClick={createNewLayout}
          aria-label="Create new layout"
          data-testid="add-layout"
          title="Create new layout"
        >
          <AddIcon />
        </IconButton>,
        <IconButton
          color="primary"
          key="import-layout"
          onClick={importLayout}
          aria-label="Import layout"
          title="Import layout"
        >
          <FileOpenOutlinedIcon />
        </IconButton>,
      ].filter(Boolean)}
    >
      {unsavedChangesPrompt}
      <Stack fullHeight gap={2} style={{ pointerEvents: pendingMultiAction ? "none" : "auto" }}>
        <LayoutSection
          title={layoutManager.supportsSharing ? "Personal" : undefined}
          emptyText="Add a new layout to get started with Foxglove Studio!"
          items={layouts.value?.personal}
          multiSelectedIds={state.selectedIds}
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
        {layoutManager.supportsSharing && (
          <LayoutSection
            title="Team"
            emptyText="Your organization doesn’t have any shared layouts yet. Share a personal layout to collaborate with other team members."
            items={layouts.value?.shared}
            multiSelectedIds={state.selectedIds}
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
        <Stack flexGrow={1} />
        {showSignInPrompt && <SignInPrompt onDismiss={() => void setHideSignInPrompt(true)} />}
        {layoutDebug && (
          <Stack
            gap={0.5}
            padding={1}
            position="sticky"
            style={{
              bottom: 0,
              left: 0,
              right: 0,
              background: theme.palette.background.default,
              ...debugBorder,
            }}
          >
            <Stack direction="row" flex="auto" gap={1}>
              <Button
                onClick={async () => {
                  await layoutDebug.syncNow();
                  await reloadLayouts();
                }}
              >
                Sync
              </Button>

              <Stack flex="auto" />

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={layoutManager.isOnline}
                      onChange={(_, checked) => {
                        layoutDebug.setOnline(checked);
                      }}
                    />
                  }
                  label={layoutManager.isOnline ? "Online" : "Offline"}
                />
              </FormGroup>
            </Stack>
          </Stack>
        )}
      </Stack>
    </SidebarContent>
  );
}
