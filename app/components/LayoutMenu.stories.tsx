// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import LayoutMenu from "@foxglove/studio-base/components/LayoutMenu";
import CurrentLayoutContext from "@foxglove/studio-base/context/CurrentLayoutContext";
import LayoutStorageContext, {
  Layout,
  LayoutStorage,
} from "@foxglove/studio-base/context/LayoutStorageContext";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";

class FakeLayoutStorage implements LayoutStorage {
  private _layouts: Layout[];

  constructor(layouts: Layout[] = []) {
    this._layouts = layouts;
  }
  list(): Promise<Layout[]> {
    return Promise.resolve(this._layouts);
  }
  get(_id: string): Promise<Layout | undefined> {
    throw new Error("Method not implemented.");
  }
  put(_layout: unknown): Promise<void> {
    throw new Error("Method not implemented.");
  }
  delete(_id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default {
  title: "components/LayoutMenu",
  component: LayoutMenu,
};

export function Empty(): JSX.Element {
  const storage = useMemo(() => new FakeLayoutStorage(), []);
  const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);

  return (
    <div style={{ display: "flex", height: 400 }}>
      <CurrentLayoutContext.Provider value={currentLayout}>
        <LayoutStorageContext.Provider value={storage}>
          <LayoutMenu defaultIsOpen />
        </LayoutStorageContext.Provider>
      </CurrentLayoutContext.Provider>
    </div>
  );
}

export function LayoutList(): JSX.Element {
  const storage = useMemo(
    () =>
      new FakeLayoutStorage([
        {
          id: "not-current",
          name: "Another Layout",
          state: undefined,
        },
        {
          id: "test-id",
          name: "Current Layout",
          state: undefined,
        },
        {
          id: "short-id",
          name: "Short",
          state: undefined,
        },
      ]),
    [],
  );

  const mockLayoutContext = useMemo(() => {
    const mockLayout = {
      id: "test-id",
      configById: {},
      globalVariables: {},
      userNodes: {},
      linkedGlobalVariables: [],
      playbackConfig: defaultPlaybackConfig,
    };
    const state = new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS);
    state.actions.loadLayout(mockLayout);
    return state;
  }, []);

  return (
    <div style={{ display: "flex", height: 400 }}>
      <CurrentLayoutContext.Provider value={mockLayoutContext}>
        <LayoutStorageContext.Provider value={storage}>
          <LayoutMenu defaultIsOpen />
        </LayoutStorageContext.Provider>
      </CurrentLayoutContext.Provider>
    </div>
  );
}
