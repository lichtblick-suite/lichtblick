// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import assert from "assert";
import { useEffect } from "react";
import { useDebounce } from "use-debounce";

import Log from "@foxglove/log";
import {
  LayoutID,
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { defaultLayout } from "@foxglove/studio-base/providers/CurrentLayoutProvider/defaultLayout";
import { migratePanelsState } from "@foxglove/studio-base/services/migrateLayout";

function selectLayoutData(state: LayoutState) {
  return state.selectedLayout?.data;
}

const log = Log.getLogger(__filename);

const KEY = "studio.layout";

export function CurrentLayoutLocalStorageSyncAdapter(): JSX.Element {
  const { selectedSource } = usePlayerSelection();

  const { setCurrentLayoutState } = useCurrentLayoutActions();
  const currentLayoutData = useCurrentLayoutSelector(selectLayoutData);

  useEffect(() => {
    if (selectedSource?.sampleLayout) {
      setCurrentLayoutState({
        selectedLayout: {
          id: "default" as LayoutID,
          data: selectedSource.sampleLayout,
        },
      });
    }
  }, [selectedSource, setCurrentLayoutState]);

  const [debouncedLayoutData] = useDebounce(currentLayoutData, 250, { maxWait: 500 });

  useEffect(() => {
    if (!debouncedLayoutData) {
      return;
    }

    const serializedLayoutData = JSON.stringify(debouncedLayoutData);
    assert(serializedLayoutData);
    localStorage.setItem(KEY, serializedLayoutData);
  }, [debouncedLayoutData]);

  useEffect(() => {
    log.debug(`Reading layout from local storage: ${KEY}`);

    const serializedLayoutData = localStorage.getItem(KEY);

    if (serializedLayoutData) {
      log.debug("Restoring layout from local storage");
    } else {
      log.debug("No layout found in local storage. Using default layout.");
    }

    const layoutData = migratePanelsState(
      serializedLayoutData ? (JSON.parse(serializedLayoutData) as LayoutData) : defaultLayout,
    );
    setCurrentLayoutState({
      selectedLayout: {
        id: "default" as LayoutID,
        data: layoutData,
      },
    });
  }, [setCurrentLayoutState]);

  return <></>;
}
