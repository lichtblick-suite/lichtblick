// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";
import { MouseEvent, Dispatch } from "react";
import useAsyncFn from "react-use/lib/useAsyncFn";

import { useLayoutBrowserReducer } from "@lichtblick/suite-base/components/LayoutBrowser/reducer";
import {
  LayoutSelectionState,
  LayoutSelectionAction,
} from "@lichtblick/suite-base/components/LayoutBrowser/types";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import useCallbackWithToast from "@lichtblick/suite-base/hooks/useCallbackWithToast";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import { Layout, layoutIsShared } from "@lichtblick/suite-base/services/ILayoutStorage";

export type UseLayoutNavigation = {
  onSelectLayout: (
    item: Layout,
    params?: { selectedViaClick?: boolean; event?: MouseEvent },
  ) => Promise<void>;
  state: LayoutSelectionState;
  dispatch: Dispatch<LayoutSelectionAction>;
};

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

export function useLayoutNavigation(menuClose?: () => void): UseLayoutNavigation {
  const currentLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
  const layoutManager = useLayoutManager();
  const analytics = useAnalytics();
  const { setSelectedLayoutId } = useCurrentLayoutActions();

  const [state, dispatch] = useLayoutBrowserReducer({
    lastSelectedId: currentLayoutId,
    busy: layoutManager.isBusy(),
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

  const onSelectLayout = useCallbackWithToast(
    async (
      item: Layout,
      { selectedViaClick = false, event }: { selectedViaClick?: boolean; event?: MouseEvent } = {},
    ) => {
      if (selectedViaClick) {
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
    [analytics, currentLayoutId, dispatch, layouts.value, menuClose, setSelectedLayoutId],
  );

  return { onSelectLayout, state, dispatch };
}
