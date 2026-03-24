// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import assert from "assert";
import { useEffect } from "react";
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

  const layoutManager = useLayoutManager();

  const [debouncedLayoutData] = useDebounce(currentLayoutData, 250, { maxWait: 500 });

  useEffect(() => {
    if (!debouncedLayoutData) {
      return;
    }

    const serializedLayoutData = JSON.stringify(debouncedLayoutData);
    assert(serializedLayoutData);
    localStorage.setItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY, serializedLayoutData);
  }, [debouncedLayoutData]);

  // Send new layoutData to layoutManager to be saved, but only when the user
  // has actually edited the layout. The `edited` flag is set exclusively by
  // panel actions (performAction) that produce a real data change, so we avoid
  // persisting a working copy from panel initialization side-effects.
  useAsync(async () => {
    const layoutState = getCurrentLayoutState();

    if (!(layoutState.selectedLayout?.edited ?? false)) {
      return;
    }

    try {
      await layoutManager.updateLayout({
        id: layoutState.selectedLayout!.id,
        data: debouncedLayoutData,
      });
    } catch (error) {
      log.error(error);
    }
  }, [debouncedLayoutData, getCurrentLayoutState, layoutManager]);

  return <></>;
}
