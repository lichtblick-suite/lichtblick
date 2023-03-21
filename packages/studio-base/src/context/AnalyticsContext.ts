// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import IAnalytics from "@foxglove/studio-base/services/IAnalytics";
import NullAnalytics from "@foxglove/studio-base/services/NullAnalytics";

const AnalyticsContext = createContext<IAnalytics>(new NullAnalytics());
AnalyticsContext.displayName = "AnalyticsContext";

export function useAnalytics(): IAnalytics {
  return useContext(AnalyticsContext);
}

// ts-prune-ignore-next
export default AnalyticsContext;
