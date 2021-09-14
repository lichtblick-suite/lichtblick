// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";

import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";

type ILayoutStorageDebugging = {
  syncNow: () => Promise<void>;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setOnline: (online: boolean) => void;
  injectEdit: (id: LayoutID) => Promise<void>;
  injectRename: (id: LayoutID) => Promise<void>;
  injectDelete: (id: LayoutID) => Promise<void>;
};

export default createContext<ILayoutStorageDebugging | undefined>(undefined);
