// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { redoLayoutChange, undoLayoutChange } from "@foxglove-studio/app/actions/layoutHistory";
import { changePanelLayout, savePanelConfigs } from "@foxglove-studio/app/actions/panels";
import { State } from "@foxglove-studio/app/reducers";
import { NEVER_PUSH_LAYOUT_THRESHOLD_MS } from "@foxglove-studio/app/reducers/layoutHistory";
import { GLOBAL_STATE_STORAGE_KEY } from "@foxglove-studio/app/reducers/panels";
import delay from "@foxglove-studio/app/shared/delay";
import { getGlobalStoreForTest } from "@foxglove-studio/app/store/getGlobalStore";
import Storage from "@foxglove-studio/app/util/Storage";

const storage = new Storage();

const getStore = () => {
  const store = getGlobalStoreForTest();
  const checkState = (fn: (arg: Pick<State, "persistedState" | "layoutHistory">) => void) => {
    const { persistedState, layoutHistory } = store.getState();
    fn({
      persistedState: { ...persistedState },
      layoutHistory,
    });
  };
  return { store, checkState };
};

describe("state.layoutHistory", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("stores initial empty history", () => {
    const { checkState } = getStore();
    checkState(({ layoutHistory }) => {
      expect(layoutHistory).toEqual({ lastTimestamp: 0, redoStates: [], undoStates: [] });
    });
  });

  it("can undo and redo layout changes", async () => {
    const baseUrl = "http://localhost/";
    const { store, checkState } = getStore();
    store.dispatch(changePanelLayout({ layout: "foo!1234" }));
    // eslint-disable-next-line no-restricted-syntax
    history.replaceState(null, document.title, `${baseUrl}?layout=foo!1234`);
    checkState(({ layoutHistory, persistedState }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // original state
      expect(persistedState.panels.layout).toEqual("foo!1234");
      expect(storage.getItem(GLOBAL_STATE_STORAGE_KEY)).toEqual(persistedState);
    });

    await delay(NEVER_PUSH_LAYOUT_THRESHOLD_MS + 100);
    store.dispatch(changePanelLayout({ layout: "bar!5678" }));
    // eslint-disable-next-line no-restricted-syntax
    history.replaceState(null, document.title, `${baseUrl}?layout=bar!5678`);
    checkState(({ layoutHistory, persistedState }) => {
      expect(layoutHistory.undoStates.length).toEqual(2); // original and foo!1234
      expect(layoutHistory.undoStates.map(({ url }) => url)).toEqual([
        baseUrl,
        `${baseUrl}?layout=foo!1234`,
      ]);
      expect(persistedState.panels.layout).toEqual("bar!5678");
      expect(storage.getItem(GLOBAL_STATE_STORAGE_KEY)).toEqual(persistedState);
    });

    store.dispatch(redoLayoutChange()); // no change from before
    checkState(({ layoutHistory, persistedState }) => {
      expect(layoutHistory.undoStates.length).toEqual(2); // original and foo!1234
      expect(persistedState.panels.layout).toEqual("bar!5678");
      expect(storage.getItem(GLOBAL_STATE_STORAGE_KEY)).toEqual(persistedState);
    });

    store.dispatch(undoLayoutChange()); // no change from before
    checkState(({ layoutHistory, persistedState }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // original state
      expect(layoutHistory.redoStates.length).toEqual(1); // bar!5678
      expect(persistedState.panels.layout).toEqual("foo!1234");
      expect(window.location.href).toEqual(`${baseUrl}?layout=foo!1234`);
      expect(storage.getItem(GLOBAL_STATE_STORAGE_KEY)).toEqual(persistedState);
    });

    store.dispatch(redoLayoutChange()); // no change from before
    checkState(({ layoutHistory, persistedState }) => {
      expect(layoutHistory.undoStates.length).toEqual(2); // original and foo!1234
      expect(layoutHistory.redoStates.length).toEqual(0);
      expect(persistedState.panels.layout).toEqual("bar!5678");
      expect(window.location.href).toEqual(`${baseUrl}?layout=bar!5678`);
      expect(storage.getItem(GLOBAL_STATE_STORAGE_KEY)).toEqual(persistedState);
    });
  });

  it("does not debounce state changes when too much time has passed", () => {
    const { store, checkState } = getStore();

    let timeMs = 100000;
    jest.spyOn(Date, "now").mockImplementation(() => timeMs);

    store.dispatch(changePanelLayout({ layout: "foo!1234" }));
    checkState(({ persistedState }) => {
      expect(persistedState.panels.savedProps).toEqual({});
    });

    // Make some changes slowly.
    store.dispatch(savePanelConfigs({ configs: [{ id: "a!1", config: { value: 1 } }] }));
    timeMs += 6000;
    store.dispatch(savePanelConfigs({ configs: [{ id: "a!1", config: { value: 2 } }] }));
    timeMs += 6000;
    store.dispatch(savePanelConfigs({ configs: [{ id: "a!1", config: { value: 3 } }] }));

    checkState(({ persistedState }) => {
      expect(persistedState.panels.savedProps).toEqual({ "a!1": { value: 3 } });
    });

    // Do not skip over value=2
    store.dispatch(undoLayoutChange());
    checkState(({ persistedState }) => {
      expect(persistedState.panels.savedProps).toEqual({ "a!1": { value: 2 } });
    });

    // Do not skip over value=1
    store.dispatch(undoLayoutChange());
    checkState(({ persistedState }) => {
      expect(persistedState.panels.savedProps).toEqual({ "a!1": { value: 1 } });
    });

    // Back to the original state.
    store.dispatch(undoLayoutChange());
    checkState(({ persistedState }) => {
      expect(persistedState.panels.savedProps).toEqual({});
    });
  });

  it("suppresses history when not enough time passes", async () => {
    const { store, checkState } = getStore();
    store.dispatch(changePanelLayout({ layout: "foo!1234" }));
    checkState(({ layoutHistory }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // original state
    });

    // No time in between.
    store.dispatch(changePanelLayout({ layout: "foo!1234" }));
    checkState(({ layoutHistory }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // unchanged
    });

    await delay(NEVER_PUSH_LAYOUT_THRESHOLD_MS + 100);
    store.dispatch(changePanelLayout({ layout: "bar!5678" }));
    checkState(({ layoutHistory }) => {
      expect(layoutHistory.undoStates.length).toEqual(2); // updated
    });
  });

  it("suppresses history entries when told to", async () => {
    const { store, checkState } = getStore();
    store.dispatch(changePanelLayout({ layout: "foo!1234" }));
    checkState(({ layoutHistory }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // original state
    });

    await delay(NEVER_PUSH_LAYOUT_THRESHOLD_MS + 100);
    store.dispatch(
      changePanelLayout({ layout: "bar!5678", historyOptions: "SUPPRESS_HISTORY_ENTRY" }),
    );
    checkState(({ layoutHistory }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // unchanged
    });
  });

  it("suppresses history entries when nothing changed", async () => {
    const { store, checkState } = getStore();
    store.dispatch(changePanelLayout({ layout: "foo!1234" }));
    checkState(({ layoutHistory }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // original state
    });

    await delay(NEVER_PUSH_LAYOUT_THRESHOLD_MS + 100);
    store.dispatch(changePanelLayout({ layout: "foo!1234" }));
    checkState(({ layoutHistory }) => {
      expect(layoutHistory.undoStates.length).toEqual(1); // unchanged
    });
  });
});
