// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";
import { useCallback, MouseEvent } from "react";
import useAsyncFn from "react-use/lib/useAsyncFn";

import { useLayoutBrowserReducer } from "@lichtblick/suite-base/components/LayoutBrowser/reducer";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import useCallbackWithToast from "@lichtblick/suite-base/hooks/useCallbackWithToast";
import { Layout, layoutIsShared } from "@lichtblick/suite-base/services/ILayoutStorage";

import { useUnsavedChangesPrompt } from "../components/LayoutBrowser/UnsavedChangesPrompt";
import { useAnalytics } from "../context/AnalyticsContext";
import { useLayoutManager } from "../context/LayoutManagerContext";
import { AppEvent } from "../services/IAnalytics";

export type UseLayoutNavigation = {
  promptForUnsavedChanges: () => Promise<boolean>;
  onSelectLayout: (
    item: Layout,
    params?: { selectedViaClick?: boolean; event?: MouseEvent },
  ) => Promise<void>;
};

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

export function useLayoutNavigation(menuClose?: () => void): UseLayoutNavigation {
  const currentLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
  const layoutManager = useLayoutManager();
  const analytics = useAnalytics();
  const { openUnsavedChangesPrompt } = useUnsavedChangesPrompt();
  const { setSelectedLayoutId } = useCurrentLayoutActions();

  //problem here
  const [, dispatch] = useLayoutBrowserReducer({
    lastSelectedId: currentLayoutId,
    busy: layoutManager.isBusy,
    error: layoutManager.error,
    online: layoutManager.isOnline,
  });

  const [layouts] = useAsyncFn(
    async () => {
      const [shared, personal] = _.partition(
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
        menuClose?.();
      }
    },
    [
      analytics,
      currentLayoutId,
      dispatch,
      layouts.value,
      menuClose,
      promptForUnsavedChanges,
      setSelectedLayoutId,
    ],
  );

  return { promptForUnsavedChanges, onSelectLayout };
}
