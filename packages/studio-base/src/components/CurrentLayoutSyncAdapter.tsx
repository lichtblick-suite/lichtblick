// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { enqueueSnackbar } from "notistack";
import { useEffect, useState } from "react";
import { useAsync, useMountedState } from "react-use";
import { useDebounce } from "use-debounce";

import Logger from "@foxglove/log";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";

type UpdatedLayout = NonNullable<LayoutState["selectedLayout"]>;

const log = Logger.getLogger(__filename);

const EMPTY_UNSAVED_LAYOUTS: Record<LayoutID, UpdatedLayout> = {};
const SAVE_INTERVAL_MS = 1000;

const selectCurrentLayout = (state: LayoutState) => state.selectedLayout;

/**
 * Observes changes in the current layout and asynchronously pushes them to the
 * layout manager.
 */
export function CurrentLayoutSyncAdapter(): ReactNull {
  const selectedLayout = useCurrentLayoutSelector(selectCurrentLayout);

  const layoutManager = useLayoutManager();

  const [unsavedLayouts, setUnsavedLayouts] = useState(EMPTY_UNSAVED_LAYOUTS);

  const isMounted = useMountedState();

  const analytics = useAnalytics();

  useEffect(() => {
    if (selectedLayout?.edited === true) {
      setUnsavedLayouts((old) => ({
        ...old,
        [selectedLayout.id]: selectedLayout,
      }));
    }
  }, [selectedLayout]);

  const [debouncedUnsavedLayouts, debouncedUnsavedLayoutActions] = useDebounce(
    unsavedLayouts,
    SAVE_INTERVAL_MS,
  );

  // Flush and clear pending updates on unmount.
  useEffect(() => {
    return () => {
      debouncedUnsavedLayoutActions.flush();
      debouncedUnsavedLayoutActions.cancel();
    };
  }, [debouncedUnsavedLayoutActions]);

  // Write all pending layout updates to the layout manager. Under the hood this
  // uses useEffect so it happens after DOM updates are complete.
  useAsync(async () => {
    const unsavedLayoutsSnapshot = { ...debouncedUnsavedLayouts };
    setUnsavedLayouts(EMPTY_UNSAVED_LAYOUTS);

    for (const params of Object.values(unsavedLayoutsSnapshot)) {
      try {
        await layoutManager.updateLayout(params);
      } catch (error) {
        log.error(error);
        if (isMounted()) {
          enqueueSnackbar(`Your changes could not be saved. ${error.toString()}`, {
            variant: "error",
            key: "CurrentLayoutProvider.throttledSave",
          });
        }
      }
    }

    void analytics.logEvent(AppEvent.LAYOUT_UPDATE);
  }, [analytics, debouncedUnsavedLayouts, isMounted, layoutManager]);

  return ReactNull;
}
