// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { Analytics } from "@foxglove/studio-base/services/Analytics";

const AnalyticsContext = createContext<Analytics | undefined>(undefined);

export function useAnalytics(): Analytics {
  const analytics = useContext(AnalyticsContext);
  if (analytics == undefined) {
    throw new Error("An AnalyticsContext provider is required to useAnalytics");
  }
  return analytics;
}

export default AnalyticsContext;
