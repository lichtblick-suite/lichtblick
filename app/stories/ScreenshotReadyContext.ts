// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

// indicate that screenshot is ready for capture
type ScreenshotReady = () => void;

const ScreenshotReadyContext = createContext<ScreenshotReady | undefined>(undefined);

export function useScreenshotReady(): ScreenshotReady {
  const ctx = useContext(ScreenshotReadyContext);
  if (!ctx) {
    throw new Error("ScreenshotContext Provider is required to useScreenshotReady");
  }

  return ctx;
}

export default ScreenshotReadyContext;
