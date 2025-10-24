// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import assert from "assert";
import { useEffect, useRef } from "react";
import { useAsync } from "react-use";
import { useDebounce } from "use-debounce";

import Log from "@lichtblick/log";
import { LOCAL_STORAGE_STUDIO_LAYOUT_KEY } from "@lichtblick/suite-base/constants/browserStorageKeys";
import {
  LayoutData,
  LayoutID,
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";

export function selectLayoutData(state: LayoutState): LayoutData | undefined {
  return state.selectedLayout?.data;
}

export function selectLayoutId(state: LayoutState): LayoutID | undefined {
  return state.selectedLayout?.id;
}

const log = Log.getLogger(__filename);

export function CurrentLayoutLocalStorageSyncAdapter(): React.JSX.Element {
  const { getCurrentLayoutState } = useCurrentLayoutActions();
  const currentLayoutData = useCurrentLayoutSelector(selectLayoutData);
  const currentLayoutId = useCurrentLayoutSelector(selectLayoutId);

  const layoutManager = useLayoutManager();

  const [debouncedLayoutData] = useDebounce(currentLayoutData, 250, { maxWait: 500 });

  // Track if this is the initial layout load to prevent false "edited" states
  const isInitialLayoutLoad = useRef(true);

  // Reset the flag when layout changes
  useEffect(() => {
    isInitialLayoutLoad.current = true;
  }, [currentLayoutId]);

  useEffect(() => {
    if (!debouncedLayoutData) {
      return;
    }

    const serializedLayoutData = JSON.stringify(debouncedLayoutData);
    assert(serializedLayoutData);
    localStorage.setItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY, serializedLayoutData);
  }, [debouncedLayoutData]);

  // Send new layoutData to layoutManager to be saved
  useAsync(async () => {
    const layoutState = getCurrentLayoutState();

    if (!layoutState.selectedLayout) {
      return;
    }

    // Skip updating layout manager during initial layout load to prevent
    // false "edited" states from panel initialization
    if (isInitialLayoutLoad.current) {
      isInitialLayoutLoad.current = false;
      return;
    }

    try {
      // We only update the layout data (panels configuration) here, not the name.
      // Name changes are handled separately via layoutManager.updateLayout in rename operations.
      // This ensures that data modifications are saved to the 'working' copy in IDB,
      // allowing users to see the orange dot indicator for unsaved changes.
      await layoutManager.updateLayout({
        id: layoutState.selectedLayout.id,
        data: debouncedLayoutData,
      });
    } catch (error) {
      log.error(error);
    }
  }, [debouncedLayoutData, getCurrentLayoutState, layoutManager]);

  return <></>;
}
