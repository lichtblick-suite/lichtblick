// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as React from "react";
import type { DndProviderProps } from "react-dnd";

declare module "react-dnd" {
  // Patch type definitions to support React 18 version of @types/react, which doesn't include
  // children by default
  export const DndProvider: React.FC<React.PropsWithChildren<DndProviderProps<unknown, unknown>>>;
}
