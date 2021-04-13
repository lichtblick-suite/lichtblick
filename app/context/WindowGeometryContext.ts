// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

type WindowGeometry = {
  // Whether the toolbar should be inset on the left side to allow space for "traffic light" buttons
  insetToolbar: boolean;
};
const WindowGeometryContext = createContext<WindowGeometry>({ insetToolbar: false });

export function useWindowGeometry(): WindowGeometry {
  return useContext(WindowGeometryContext);
}

export default WindowGeometryContext;
