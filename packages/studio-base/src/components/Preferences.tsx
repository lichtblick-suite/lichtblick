// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  Checkbox,
  ChoiceGroup,
  DirectionalHint,
  IChoiceGroupOption,
  IComboBoxOption,
  SelectableOptionMenuItemType,
  Stack,
  Text,
  TextField,
  useTheme,
  VirtualizedComboBox,
} from "@fluentui/react";
import moment from "moment-timezone";
import { useCallback, useMemo, useState } from "react";

import { filterMap } from "@foxglove/den/collection";
import { RosNode } from "@foxglove/ros1";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import { ExperimentalFeatureSettings } from "@foxglove/studio-base/components/ExperimentalFeatureSettings";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import fuzzyFilter from "@foxglove/studio-base/util/fuzzyFilter";

const MESSAGE_RATES = [1, 3, 5, 10, 15, 20, 30, 60];

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

function ColorSchemeSettings(): JSX.Element {
  const [colorScheme = "dark", setColorScheme] = useAppConfigurationValue<string>(
    AppSetting.COLOR_SCHEME,
  );
  const options: IChoiceGroupOption[] = useMemo(
    () => [
      { key: "light", text: "Light", iconProps: { iconName: "WeatherSunny" } },
      { key: "dark", text: "Dark", iconProps: { iconName: "WeatherMoon" } },
      { key: "system", text: "Follow system", iconProps: { iconName: "CircleHalfFill" } },
    ],
    [],
  );
  return (
    <ChoiceGroup
      label="Color scheme"
      options={options}
      selectedKey={colorScheme}
      onChange={(_event, option) => {
        if (option != undefined) {
          void setColorScheme(option.key);
        }
      }}
    />
  );
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

  const selectedItem = useMemo(
    () => itemsByData.get(timezone ?? "") ?? detectItem,
    [itemsByData, timezone, detectItem],
  );

  const [filterText, setFilterText] = useState<string>("");
  const filteredItems = useMemo(() => {
    const matchingItems = fuzzyFilter({
      options: timezoneItems,
      filter: filterText,
      getText: (item) => item.text,
    });
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
          void setTimezone(option.data);
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

function MessageFramerate(): React.ReactElement {
  const [messageRate, setMessageRate] = useAppConfigurationValue<number>(AppSetting.MESSAGE_RATE);
  const entries = useMemo(
    () => MESSAGE_RATES.map((rate) => ({ key: rate, text: `${rate}`, data: rate })),
    [],
  );

  return (
    <VirtualizedComboBox
      label="Message rate (Hz):"
      options={entries}
      autoComplete="on"
      openOnKeyboardFocus
      selectedKey={messageRate ?? 60}
      onChange={(_event, option) => {
        if (option) {
          void setMessageRate(option.data);
        }
      }}
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
      onChange={(_event, newValue) => void setRosHostname(newValue ? newValue : undefined)}
    />
  );
}

function RosPackagePath(): React.ReactElement {
  const [rosPackagePath, setRosPackagePath] = useAppConfigurationValue<string>(
    AppSetting.ROS_PACKAGE_PATH,
  );

  const os = OsContextSingleton;
  const rosPackagePathPlaceholder = useMemo(() => os?.getEnvVar("ROS_PACKAGE_PATH"), [os]);

  return (
    <TextField
      label="ROS_PACKAGE_PATH"
      placeholder={rosPackagePathPlaceholder}
      value={rosPackagePath ?? ""}
      onChange={(_event, newValue) => void setRosPackagePath(newValue ? newValue : undefined)}
    />
  );
}

function SectionHeader({ children }: React.PropsWithChildren<unknown>) {
  const theme = useTheme();
  return (
    <Text
      block
      as="h2"
      variant="large"
      style={{
        marginBottom: theme.spacing.s1,
        color: theme.palette.themeSecondary,
      }}
    >
      {children}
    </Text>
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
      <Stack tokens={{ childrenGap: 30 }}>
        <Stack.Item>
          <SectionHeader>General</SectionHeader>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            <Stack.Item>
              <ColorSchemeSettings />
            </Stack.Item>
            <Stack.Item>
              <TimezoneSettings />
            </Stack.Item>
            <Stack.Item>
              <MessageFramerate />
            </Stack.Item>
          </Stack>
        </Stack.Item>
        <Stack.Item>
          <SectionHeader>ROS</SectionHeader>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            <Stack.Item>
              <RosHostname />
            </Stack.Item>
            <Stack.Item>
              <RosPackagePath />
            </Stack.Item>
          </Stack>
        </Stack.Item>
        <Stack.Item>
          <SectionHeader>Privacy</SectionHeader>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            <Text style={{ color: theme.palette.neutralSecondary }}>
              Changes will take effect the next time Foxglove Studio is launched.
            </Text>
            <Checkbox
              checked={telemetryEnabled ?? true}
              onChange={(_event, checked) => void setTelemetryEnabled(checked)}
              label={`Send anonymized usage data to help us improve Foxglove Studio`}
            />
            <Checkbox
              checked={crashReportingEnabled ?? true}
              onChange={(_event, checked) => void setCrashReportingEnabled(checked)}
              label="Send anonymized crash reports"
            />
          </Stack>
        </Stack.Item>
        <Stack.Item>
          <SectionHeader>Experimental features</SectionHeader>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            <Text style={{ color: theme.palette.neutralSecondary }}>
              These features are unstable and not recommended for daily use.
            </Text>
            <ExperimentalFeatureSettings />
          </Stack>
        </Stack.Item>
      </Stack>
    </SidebarContent>
  );
}
