// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { createMemoryHistory } from "history";

import updateUrlAndLocalStorageMiddleware from "@foxglove-studio/app/middleware/updateUrlAndLocalStorage";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store";
import configureTestingStore from "@foxglove-studio/app/store/configureStore.testing";

type Store = ReturnType<typeof configureStore>;

interface TestStore extends Store {
  push?: (path: string) => void;
}

let store: Store | undefined = undefined;
function getGlobalStore(): Store {
  if (!store) {
    store = configureStore(createRootReducer(), [updateUrlAndLocalStorageMiddleware]);
  }
  return store;
}

export function getGlobalStoreForTest(args?: { search?: string; testAuth?: unknown }): TestStore {
  const memoryHistory = createMemoryHistory();
  const testStore = configureTestingStore(
    createRootReducer({ testAuth: args?.testAuth }),
    [updateUrlAndLocalStorageMiddleware],
    memoryHistory,
  );

  // Attach a helper method to the test store.
  (testStore as TestStore).push = (path: string) => memoryHistory.push(path);

  return testStore;
}
export default getGlobalStore;
