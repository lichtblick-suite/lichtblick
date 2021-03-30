// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import AnalyticsContext from "@foxglove-studio/app/context/AnalyticsContext";
import { useAsyncAppConfigurationValue } from "@foxglove-studio/app/hooks/useAsyncAppConfigurationValue";
import { Analytics } from "@foxglove-studio/app/services/Analytics";

export default function AnalyticsProvider(
  props: PropsWithChildren<{ amplitudeApiKey?: string }>,
): React.ReactElement {
  const [telemetryState] = useAsyncAppConfigurationValue<boolean>("telemetry.telemetryEnabled");
  const optOut = !(telemetryState.value ?? true);
  const ready = !telemetryState.loading;

  const analytics = useMemo(() => {
    return new Analytics({
      optOut,
      amplitudeApiKey: props.amplitudeApiKey ?? process.env.AMPLITUDE_API_KEY,
    });
  }, [optOut, props.amplitudeApiKey]);

  return (
    <AnalyticsContext.Provider value={analytics}>
      {ready ? props.children : undefined}
    </AnalyticsContext.Provider>
  );
}
