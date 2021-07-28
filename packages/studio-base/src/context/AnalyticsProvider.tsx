// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AnalyticsContext from "@foxglove/studio-base/context/AnalyticsContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { AmplitudeAnalytics } from "@foxglove/studio-base/services/AmplitudeAnalytics";

export default function AnalyticsProvider(
  props: PropsWithChildren<{ amplitudeApiKey?: string }>,
): React.ReactElement {
  const [enableTelemetry = true] = useAppConfigurationValue<boolean>(AppSetting.TELEMETRY_ENABLED);
  const [enableCrashReporting = true] = useAppConfigurationValue<boolean>(
    AppSetting.CRASH_REPORTING_ENABLED,
  );

  const analytics = useMemo(() => {
    return new AmplitudeAnalytics({
      optOut: !enableTelemetry,
      crashReportingOptOut: !(enableCrashReporting && typeof process.env.SENTRY_DSN === "string"),
      amplitudeApiKey: props.amplitudeApiKey ?? process.env.AMPLITUDE_API_KEY,
    });
  }, [props.amplitudeApiKey, enableTelemetry, enableCrashReporting]);

  return <AnalyticsContext.Provider value={analytics}>{props.children}</AnalyticsContext.Provider>;
}
