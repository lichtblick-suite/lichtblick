// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import AnalyticsContext from "@foxglove-studio/app/context/AnalyticsContext";
import { Analytics } from "@foxglove-studio/app/services/Analytics";

export default function AnalyticsProvider(
  props: PropsWithChildren<{ amplitudeApiKey?: string }>,
): React.ReactElement {
  const analytics = useMemo(() => {
    return new Analytics({
      optOut: !(OsContextSingleton?.isTelemetryEnabled() ?? true),
      amplitudeApiKey: props.amplitudeApiKey ?? process.env.AMPLITUDE_API_KEY,
    });
  }, [props.amplitudeApiKey]);

  return <AnalyticsContext.Provider value={analytics}>{props.children}</AnalyticsContext.Provider>;
}
