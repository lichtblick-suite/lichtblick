// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  Checkbox,
  DirectionalHint,
  IComboBoxOption,
  Pivot,
  PivotItem,
  SelectableOptionMenuItemType,
  Stack,
  Text,
  useTheme,
  VirtualizedComboBox,
} from "@fluentui/react";
import moment from "moment-timezone";
import { useCallback, useMemo, useState } from "react";

import { ExperimentalFeatureSettings } from "@foxglove-studio/app/components/ExperimentalFeatureSettings";
import { useAsyncAppConfigurationValue } from "@foxglove-studio/app/hooks/useAsyncAppConfigurationValue";
import filterMap from "@foxglove-studio/app/util/filterMap";
import fuzzyFilter from "@foxglove-studio/app/util/fuzzyFilter";
import { APP_NAME } from "@foxglove-studio/app/version";

function formatTimezone(name: string) {
  const tz = moment.tz(name);
  const zoneAbbr = tz.zoneAbbr();
  const offset = tz.utcOffset();
  const offsetStr =
    (offset >= 0 ? "+" : "") + moment.duration(offset, "minutes").format("hh:mm", { trim: false });
  if (name === zoneAbbr) {
    return `${zoneAbbr} (${offsetStr})`;
  }
  return `${name} (${zoneAbbr}, ${offsetStr})`;
}

function TimezoneSettings(): React.ReactElement {
  type Option = IComboBoxOption & { data: string };

  const [timezone, setTimezone] = useAsyncAppConfigurationValue<string>("timezone", {
    optimistic: true, // prevent UI flicker while the new value is saving
  });
  const detectItem = useMemo(
    () => ({
      key: "detect",
      text: `Detect from system: ${formatTimezone(moment.tz.guess())}`,
      data: "",
    }),
    [],
  );
  const fixedItems: Option[] = useMemo(
    () => [
      detectItem,
      { key: "zone:UTC", text: `${formatTimezone("UTC")}`, data: "UTC" },
      { key: "sep", text: "", data: "-separator-", itemType: SelectableOptionMenuItemType.Divider },
    ],
    [detectItem],
  );
  const timezoneItems: Option[] = useMemo(
    () =>
      filterMap(moment.tz.names(), (name) => {
        // UTC is always hoisted to the top in fixedItems
        if (name === "UTC") {
          return undefined;
        }
        return { key: `zone:${name}`, text: formatTimezone(name), data: name };
      }),
    [],
  );

  const itemsByData = useMemo(() => {
    const map = new Map<string, Option>();
    for (const item of fixedItems) {
      map.set(item.data, item);
    }
    for (const item of timezoneItems) {
      map.set(item.data, item);
    }
    return map;
  }, [fixedItems, timezoneItems]);

  const selectedItem = useMemo(() => itemsByData.get(timezone.value ?? "") ?? detectItem, [
    itemsByData,
    timezone.value,
    detectItem,
  ]);

  const [filterText, setFilterText] = useState<string>("");
  const filteredItems = useMemo(() => {
    const matchingItems = fuzzyFilter(timezoneItems, filterText, (item) => item.text);
    return [...fixedItems, ...matchingItems];
  }, [fixedItems, timezoneItems, filterText]);

  const onPendingValueChanged = useCallback(
    (option?: IComboBoxOption, index?: number, value?: string) => {
      if (value != undefined) {
        setFilterText(value);
      }
    },
    [],
  );

  return (
    <VirtualizedComboBox
      label="Display timestamps in:"
      options={filteredItems}
      allowFreeform
      autoComplete="on"
      openOnKeyboardFocus
      selectedKey={selectedItem.key}
      onChange={(event, option) => {
        if (option) {
          setTimezone(option.data);
        }
      }}
      onPendingValueChanged={onPendingValueChanged}
      calloutProps={{
        directionalHint: DirectionalHint.bottomLeftEdge,
        directionalHintFixed: true,
      }}
    />
  );
}

export default function Preferences(): React.ReactElement {
  const theme = useTheme();

  const [crashReportingEnabled, setCrashReportingEnabled] = useAsyncAppConfigurationValue<boolean>(
    "telemetry.crashReportingEnabled",
  );
  const [telemetryEnabled, setTelemetryEnabled] = useAsyncAppConfigurationValue<boolean>(
    "telemetry.telemetryEnabled",
  );

  return (
    <Pivot>
      <PivotItem headerText="Settings" style={{ padding: theme.spacing.m }}>
        <Stack.Item>
          <TimezoneSettings />
        </Stack.Item>
      </PivotItem>
      {
        <PivotItem headerText="Privacy" style={{ padding: theme.spacing.m }}>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            <Text style={{ color: theme.palette.neutralSecondary }}>
              Changes will take effect the next time {APP_NAME} is launched.
            </Text>
            <Checkbox
              checked={telemetryEnabled.value ?? true}
              onChange={(event, checked) => setTelemetryEnabled(checked)}
              label={`Send anonymized usage data to help us improve ${APP_NAME}`}
            />
            <Checkbox
              checked={crashReportingEnabled.value ?? true}
              onChange={(event, checked) => setCrashReportingEnabled(checked)}
              label="Send anonymized crash reports"
            />
          </Stack>
        </PivotItem>
      }
      <PivotItem headerText="Experimental Features">
        <ExperimentalFeatureSettings />
      </PivotItem>
    </Pivot>
  );
}
