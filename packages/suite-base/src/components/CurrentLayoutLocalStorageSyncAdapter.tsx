// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { defaultLayout } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/defaultLayout";
import { migratePanelsState } from "@lichtblick/suite-base/services/migrateLayout";

function selectLayoutData(state: LayoutState) {
  return state.selectedLayout?.data;
}

const log = Log.getLogger(__filename);

export function CurrentLayoutLocalStorageSyncAdapter(): React.JSX.Element {
  const { selectedSource } = usePlayerSelection();

  const { setCurrentLayout, getCurrentLayoutState } = useCurrentLayoutActions();
  const currentLayoutData = useCurrentLayoutSelector(selectLayoutData);

  const layoutManager = useLayoutManager();

  useEffect(() => {
    if (selectedSource?.sampleLayout) {
      setCurrentLayout({ data: selectedSource.sampleLayout });
    }
  }, [selectedSource, setCurrentLayout]);

  const [debouncedLayoutData] = useDebounce(currentLayoutData, 250, { maxWait: 500 });

  useEffect(() => {
    if (!debouncedLayoutData) {
      return;
    }

    const serializedLayoutData = JSON.stringify(debouncedLayoutData);
    assert(serializedLayoutData);
    localStorage.setItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY, serializedLayoutData);
  }, [debouncedLayoutData]);

  useEffect(() => {
    log.debug(`Reading layout from local storage: ${LOCAL_STORAGE_STUDIO_LAYOUT_KEY}`);

    const serializedLayoutData = localStorage.getItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY);

    if (serializedLayoutData) {
      log.debug("Restoring layout from local storage");
    } else {
      log.debug("No layout found in local storage. Using default layout.");
    }

    const layoutData = migratePanelsState(
      serializedLayoutData ? (JSON.parse(serializedLayoutData) as LayoutData) : defaultLayout,
    );
    setCurrentLayout({ data: layoutData });
  }, [setCurrentLayout]);

  // Send new layoudData to layoutManager to be saved
  useAsync(async () => {
    const layoutState = getCurrentLayoutState();

    if (!layoutState.selectedLayout) {
      return;
    }
    try {
      await layoutManager.updateLayout({
        id: layoutState.selectedLayout.id,
        name: layoutState.selectedLayout.name,
        data: debouncedLayoutData,
      });
    } catch (error) {
      log.error(error);
    }
  }, [debouncedLayoutData, getCurrentLayoutState, layoutManager]);

  return <></>;
}
