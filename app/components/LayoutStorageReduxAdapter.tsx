// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAsync } from "react-use";
import { v4 as uuidv4 } from "uuid";

import { loadLayout } from "@foxglove-studio/app/actions/panels";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import { useLayoutStorage } from "@foxglove-studio/app/context/LayoutStorageContext";
import { State } from "@foxglove-studio/app/reducers";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

// LayoutStorageReduxAdapter persists the current panel state from redux to the current LayoutStorage context
export default function LayoutStorageReduxAdapter() {
  const { panels } = useSelector((state: State) => ({ panels: state.persistedState.panels }));
  const dispatch = useDispatch();

  const layoutStorage = useLayoutStorage();
  const enableLayoutManagement = useExperimentalFeature("layoutManagement");

  // save panel state to our storage
  const { error } = useAsync(async () => {
    if (!enableLayoutManagement) {
      return;
    }

    if (panels.id === undefined) {
      return;
    }

    const layout = {
      id: panels.id,
      name: panels.name ?? "unnamed",
      state: panels,
    };

    // save to our storage
    await layoutStorage.put(layout);
  }, [enableLayoutManagement, layoutStorage, panels]);

  // set an id if panel is missing one
  useEffect(() => {
    if (!enableLayoutManagement) {
      return;
    }

    if (panels.id === undefined) {
      panels.id = uuidv4();
      panels.name = panels.name ?? "unnamed";
      dispatch(loadLayout(panels));
    }
  }, [dispatch, enableLayoutManagement, panels]);

  useEffect(() => {
    if (error) {
      sendNotification(error.message, Error, "app", "error");
    }
  }, [error]);

  return ReactNull;
}
