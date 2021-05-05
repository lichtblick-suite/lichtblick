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
  TextField,
  useTheme,
  VirtualizedComboBox,
} from "@fluentui/react";
import moment from "moment-timezone";
import { useCallback, useMemo, useState } from "react";

import { AppSetting } from "@foxglove-studio/app/AppSetting";
import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import { ExperimentalFeatureSettings } from "@foxglove-studio/app/components/ExperimentalFeatureSettings";
import { SidebarContent } from "@foxglove-studio/app/components/SidebarContent";
import { useAppConfigurationValue } from "@foxglove-studio/app/hooks/useAppConfigurationValue";
import { nonEmptyOrUndefined } from "@foxglove-studio/app/util/emptyOrUndefined";
import filterMap from "@foxglove-studio/app/util/filterMap";
import fuzzyFilter from "@foxglove-studio/app/util/fuzzyFilter";
import { APP_NAME } from "@foxglove-studio/app/version";
import { RosNode } from "@foxglove/ros1";

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

  const [timezone, setTimezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);
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

  const selectedItem = useMemo(() => itemsByData.get(timezone ?? "") ?? detectItem, [
    itemsByData,
    timezone,
    detectItem,
  ]);

  const [filterText, setFilterText] = useState<string>("");
  const filteredItems = useMemo(() => {
    const matchingItems = fuzzyFilter(timezoneItems, filterText, (item) => item.text);
    return [...fixedItems, ...matchingItems];
  }, [fixedItems, timezoneItems, filterText]);

  const onPendingValueChanged = useCallback(
    (_option?: IComboBoxOption, _index?: number, value?: string) => {
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
      onChange={(_event, option) => {
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

function RosHostname(): React.ReactElement {
  const [rosHostname, setRosHostname] = useAppConfigurationValue<string>(
    AppSetting.ROS1_ROS_HOSTNAME,
  );

  const os = OsContextSingleton;
  const rosHostnamePlaceholder = useMemo(
    () =>
      os != undefined
        ? RosNode.GetRosHostname(os.getEnvVar, os.getHostname, os.getNetworkInterfaces)
        : "localhost",
    [os],
  );

  return (
    <TextField
      label="ROS_HOSTNAME"
      placeholder={rosHostnamePlaceholder}
      value={rosHostname ?? ""}
      onChange={(_event, newValue) => setRosHostname(nonEmptyOrUndefined(newValue))}
    />
  );
}

export default function Preferences(): React.ReactElement {
  const theme = useTheme();

  const [crashReportingEnabled, setCrashReportingEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.CRASH_REPORTING_ENABLED,
  );
  const [telemetryEnabled, setTelemetryEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.TELEMETRY_ENABLED,
  );

  return (
    <SidebarContent title="Preferences">
      <Pivot>
        <PivotItem headerText="General" style={{ paddingTop: theme.spacing.m }}>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            <Stack.Item>
              <TimezoneSettings />
            </Stack.Item>
            <Stack.Item>
              <RosHostname />
            </Stack.Item>
          </Stack>
        </PivotItem>
        <PivotItem headerText="Privacy" style={{ paddingTop: theme.spacing.m }}>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            <Text style={{ color: theme.palette.neutralSecondary }}>
              Changes will take effect the next time {APP_NAME} is launched.
            </Text>
            <Checkbox
              checked={telemetryEnabled ?? true}
              onChange={(_event, checked) => setTelemetryEnabled(checked)}
              label={`Send anonymized usage data to help us improve ${APP_NAME}`}
            />
            <Checkbox
              checked={crashReportingEnabled ?? true}
              onChange={(_event, checked) => setCrashReportingEnabled(checked)}
              label="Send anonymized crash reports"
            />
          </Stack>
        </PivotItem>
        <PivotItem headerText="Experimental Features">
          <ExperimentalFeatureSettings />
        </PivotItem>
      </Pivot>
    </SidebarContent>
  );
}
