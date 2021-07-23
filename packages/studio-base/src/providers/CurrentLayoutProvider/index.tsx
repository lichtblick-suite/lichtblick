// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { isEqual } from "lodash";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsync, useMountedState, useThrottle } from "react-use";

import Logger from "@foxglove/log";
import CurrentLayoutContext, {
  LayoutState,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLayoutStorage } from "@foxglove/studio-base/context/LayoutStorageContext";
import { useUserProfileStorage } from "@foxglove/studio-base/context/UserProfileStorageContext";
import welcomeLayout from "@foxglove/studio-base/layouts/welcomeLayout";
import CurrentLayoutState from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";

const log = Logger.getLogger(__filename);

function migrateLegacyLayoutFromLocalStorage() {
  let result: (Omit<PanelsState, "name"> & { name?: string }) | undefined;
  for (const key of ["webvizGlobalState", "studioGlobalState"]) {
    const value = localStorage.getItem(key);
    if (value != undefined) {
      const panels = JSON.parse(value)?.panels;
      if (panels != undefined) {
        result = panels;
      }
    }
    localStorage.removeItem(key);
  }
  return result;
}

/**
 * Once the initial layout has been determined, this component takes care of initializing the
 * CurrentLayoutState and subscribing to changes. This is done in a second step so that the
 * initialization of CurrentLayoutState can be delayed, to avoid undesired entries on the undo/redo
 * stack from a dummy initial state.
 */
function CurrentLayoutProviderWithInitialState({
  initialState,
  children,
}: React.PropsWithChildren<{ initialState: LayoutState }>) {
  const { addToast } = useToasts();

  const { setUserProfile } = useUserProfileStorage();
  const layoutStorage = useLayoutStorage();

  const [stateInstance] = useState(() => new CurrentLayoutState(initialState));
  const [layoutState, setLayoutState] = useState(() =>
    stateInstance.actions.getCurrentLayoutState(),
  );

  const isMounted = useMountedState();

  // If the current layout is deleted, deselect it
  useEffect(() => {
    const listener = async () => {
      const selectedId = stateInstance.actions.getCurrentLayoutState().selectedLayout?.id;
      if (!(await layoutStorage.getLayouts()).some(({ id }) => id === selectedId) && isMounted()) {
        stateInstance.actions.setSelectedLayout(undefined);
      }
    };
    layoutStorage.addLayoutsChangedListener(listener);
    return () => layoutStorage.removeLayoutsChangedListener(listener);
  }, [isMounted, layoutStorage, stateInstance.actions]);

  const lastCurrentLayoutId = useRef(initialState.selectedLayout?.id);
  const previousSavedState = useRef<LayoutState | undefined>();

  useLayoutEffect(() => {
    const currentState = stateInstance.actions.getCurrentLayoutState();
    // Skip initial save to LayoutStorage unless the layout changed since we initialized
    // CurrentLayoutState (e.g. for migrations)
    if (previousSavedState.current == undefined && isEqual(initialState, currentState)) {
      previousSavedState.current = currentState;
    }
    const listener = (state: LayoutState) => {
      // When a new layout is selected, we don't need to save it back to storage
      if (state.selectedLayout?.id !== previousSavedState.current?.selectedLayout?.id) {
        previousSavedState.current = state;
      }
      log.debug("state changed");
      setLayoutState(state);
    };
    stateInstance.addLayoutStateListener(listener);
    return () => stateInstance.removeLayoutStateListener(listener);
  }, [initialState, stateInstance]);

  // Save the layout to LayoutStorage.
  // Debounce the panel state to avoid persisting the layout constantly as the user is adjusting it
  const throttledLayoutState = useThrottle(layoutState, 1000 /* 1 second */);
  useEffect(() => {
    if (throttledLayoutState === previousSavedState.current) {
      // Don't save a layout that we just loaded
      return;
    }
    previousSavedState.current = throttledLayoutState;
    const { selectedLayout } = throttledLayoutState;
    if (selectedLayout == undefined) {
      return;
    }
    log.debug("updateLayout");
    layoutStorage
      .updateLayout({
        targetID: selectedLayout.id,
        data: selectedLayout.data,
        name: undefined,
      })
      .catch((error) => {
        log.error(error);
        addToast(`The current layout could not be saved. ${error.toString()}`, {
          appearance: "error",
          id: "CurrentLayoutProvider.layoutStorage.put",
        });
      });
  }, [addToast, layoutStorage, throttledLayoutState]);

  // Save the selected layout id to the UserProfile.
  useEffect(() => {
    if (layoutState.selectedLayout?.id === lastCurrentLayoutId.current) {
      return;
    }
    lastCurrentLayoutId.current = layoutState.selectedLayout?.id;
    log.debug("setUserProfile");
    setUserProfile({ currentLayoutId: layoutState.selectedLayout?.id }).catch((error) => {
      console.error(error);
      addToast(`The current layout could not be saved. ${error.toString()}`, {
        appearance: "error",
        id: "CurrentLayoutProvider.setUserProfile",
      });
    });
  }, [setUserProfile, addToast, layoutState.selectedLayout?.id]);

  return (
    <CurrentLayoutContext.Provider value={stateInstance}>{children}</CurrentLayoutContext.Provider>
  );
}

/**
 * Concrete implementation of CurrentLayoutContext.Provider which handles automatically saving and
 * restoring the current layout from LayoutStorage. Must be rendered inside a LayoutStorage
 * provider.
 */
export default function CurrentLayoutProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element | ReactNull {
  const { addToast } = useToasts();

  const { getUserProfile } = useUserProfileStorage();
  const layoutStorage = useLayoutStorage();

  const loadInitialState = useAsync(async (): Promise<LayoutState> => {
    try {
      // If a legacy layout exists in localStorage, prefer that.
      const legacyLayout = migrateLegacyLayoutFromLocalStorage();
      if (legacyLayout != undefined) {
        const { name = "unnamed", ...data } = legacyLayout;
        const newLayout = await layoutStorage.saveNewLayout({
          name,
          data,
          permission: "creator_write",
        });
        return { selectedLayout: { id: newLayout.id, data } };
      }
      // If the user's previously selected layout can be loaded, use it
      const { currentLayoutId } = await getUserProfile();
      if (currentLayoutId != undefined) {
        const layout = await layoutStorage.getLayout(currentLayoutId);
        if (layout != undefined) {
          return { selectedLayout: { id: layout.id, data: layout.data } };
        }
      }
      // Otherwise try to choose any available layout
      const allLayouts = await layoutStorage.getLayouts();
      if (allLayouts[0]) {
        const layout = await layoutStorage.getLayout(allLayouts[0].id);
        if (layout) {
          return { selectedLayout: { id: layout.id, data: layout.data } };
        }
      }
      // If none were available, load the welcome layout.
      const newLayout = await layoutStorage.saveNewLayout({
        name: welcomeLayout.name,
        data: welcomeLayout.data,
        permission: "creator_write",
      });
      return { selectedLayout: { id: newLayout.id, data: welcomeLayout.data } };
    } catch (error) {
      console.error(error);
      addToast(`The current layout could not be loaded. ${error.toString()}`, {
        appearance: "error",
        id: "CurrentLayoutProvider.load",
      });
    }
    return { selectedLayout: undefined };
  }, [addToast, getUserProfile, layoutStorage]);

  if (loadInitialState.loading) {
    return ReactNull;
  }

  return (
    <CurrentLayoutProviderWithInitialState
      initialState={loadInitialState.value ?? { selectedLayout: undefined }}
    >
      {children}
    </CurrentLayoutProviderWithInitialState>
  );
}
