/** @jest-environment jsdom */
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

import Storage from "@foxglove-studio/app/util/Storage";

import { maybeStoreNewRecentLayout, getRecentLayouts } from "./recentLayouts";

const storage = new Storage();

describe("recentLayouts", () => {
  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    storage.clear();
  });

  it("stores the initial layout in localStorage", () => {
    const initialPersistedState: any = {
      fetchedLayout: {
        data: {
          name: "initialLayout",
        },
      },
    };
    maybeStoreNewRecentLayout(initialPersistedState);
    expect(getRecentLayouts()).toEqual(["initialLayout"]);

    expect(storage.getItem("recentLayouts")).toEqual(["initialLayout"]);
  });

  it("reads recent layouts from localStorage on initialization", () => {
    storage.setItem("recentLayouts", ["storedLayout"]);
    const initialPersistedState: any = { fetchedLayout: { data: {} } };
    maybeStoreNewRecentLayout(initialPersistedState);
    expect(getRecentLayouts()).toEqual(["storedLayout"]);
  });
});
