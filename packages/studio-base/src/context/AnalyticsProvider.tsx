// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useEffect, useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AnalyticsContext from "@foxglove/studio-base/context/AnalyticsContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { AmplitudeAnalytics } from "@foxglove/studio-base/services/AmplitudeAnalytics";

export default function AnalyticsProvider(
  props: PropsWithChildren<{ amplitudeApiKey?: string }>,
): React.ReactElement {
  const [enableTelemetry = true] = useAppConfigurationValue<boolean>(AppSetting.TELEMETRY_ENABLED);
  const { currentUser } = useCurrentUser();

  const analytics = useMemo(() => {
    return new AmplitudeAnalytics({
      enableTelemetry,
      amplitudeApiKey: props.amplitudeApiKey,
    });
  }, [props.amplitudeApiKey, enableTelemetry]);

  useEffect(() => {
    analytics.setUser(currentUser);
  }, [analytics, currentUser]);

  return <AnalyticsContext.Provider value={analytics}>{props.children}</AnalyticsContext.Provider>;
}
