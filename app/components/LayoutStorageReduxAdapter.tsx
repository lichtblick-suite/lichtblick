// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAsync } from "react-use";
import { useDebounce } from "use-debounce";
import { v4 as uuidv4 } from "uuid";

import { loadLayout } from "@foxglove-studio/app/actions/panels";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import { useLayoutStorage } from "@foxglove-studio/app/context/LayoutStorageContext";
import { State } from "@foxglove-studio/app/reducers";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

// LayoutStorageReduxAdapter persists the current panel state from redux to the current LayoutStorage context
export default function LayoutStorageReduxAdapter() {
  const panelsState = useSelector((state: State) => state.persistedState.panels);
  const dispatch = useDispatch();

  // Debounce the panel state to avoid persisting the layout constantly as the user is adjusting it
  const [debouncedState] = useDebounce(panelsState, 1000 /* 1 second */);

  const layoutStorage = useLayoutStorage();
  const enableLayoutManagement = useExperimentalFeature("layoutManagement");

  // save panel state to our storage
  const { error } = useAsync(async () => {
    if (!enableLayoutManagement) {
      return;
    }

    if (debouncedState.id === undefined) {
      return;
    }

    const layout = {
      id: debouncedState.id,
      name: debouncedState.name ?? "unnamed",
      state: debouncedState,
    };

    // save to our storage
    await layoutStorage.put(layout);
  }, [enableLayoutManagement, layoutStorage, debouncedState]);

  // set an id if panel is missing one
  useEffect(() => {
    if (!enableLayoutManagement) {
      return;
    }

    if (panelsState.id === undefined) {
      panelsState.id = uuidv4();
      panelsState.name = panelsState.name ?? "unnamed";
      dispatch(loadLayout(panelsState));
    }
  }, [dispatch, enableLayoutManagement, panelsState]);

  useEffect(() => {
    if (error) {
      sendNotification(error.message, Error, "app", "error");
    }
  }, [error]);

  return ReactNull;
}
