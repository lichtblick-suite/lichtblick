// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Checkbox,
  ChoiceGroup,
  DirectionalHint,
  Dropdown,
  IChoiceGroupOption,
  IComboBoxOption,
  Label,
  SelectableOptionMenuItemType,
  TextField,
  VirtualizedComboBox,
} from "@fluentui/react";
import { Typography } from "@mui/material";
import moment from "moment-timezone";
import { useCallback, useMemo, useState } from "react";

import { filterMap } from "@foxglove/den/collection";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import { ExperimentalFeatureSettings } from "@foxglove/studio-base/components/ExperimentalFeatureSettings";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { TimeDisplayMethod } from "@foxglove/studio-base/types/panels";
import fuzzyFilter from "@foxglove/studio-base/util/fuzzyFilter";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const MESSAGE_RATES = [1, 3, 5, 10, 15, 20, 30, 60];

const os = OsContextSingleton; // workaround for https://github.com/webpack/webpack/issues/12960

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
  type Option = Omit<IComboBoxOption, "data"> & { data: string | undefined };

  const [timezone, setTimezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);
  const detectItem = useMemo(
    () => ({
      key: "detect",
      text: `Detect from system: ${formatTimezone(moment.tz.guess())}`,
      data: undefined,
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
      if (item.data != undefined) {
        map.set(item.data, item);
      }
    }
    for (const item of timezoneItems) {
      if (item.data != undefined) {
        map.set(item.data, item);
      }
    }
    return map;
  }, [fixedItems, timezoneItems]);

  const selectedItem = useMemo(
    () => (timezone != undefined && itemsByData.get(timezone)) || detectItem,
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
          void setTimezone(option.data as string);
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

function TimeFormat(): React.ReactElement {
  const { timeFormat, setTimeFormat } = useAppTimeFormat();
  const entries: Array<{ key: TimeDisplayMethod; text: string }> = [
    { key: "SEC", text: "Seconds" },
    { key: "TOD", text: "Local" },
  ];

  return (
    <Dropdown
      label="Timestamp format:"
      options={entries}
      openOnKeyboardFocus
      selectedKey={timeFormat}
      onChange={(_event, option) => {
        if (option) {
          void setTimeFormat(String(option.key) as TimeDisplayMethod);
        }
      }}
      calloutProps={{
        directionalHint: DirectionalHint.bottomLeftEdge,
        directionalHintFixed: true,
      }}
    />
  );
}

function LaunchDefault(): React.ReactElement {
  const [preference = "unknown", setPreference] = useAppConfigurationValue<string | undefined>(
    AppSetting.LAUNCH_PREFERENCE,
  );

  const entries: Array<{ key: string; text: string }> = [
    { key: "unknown", text: "Ask each time" },
    { key: "web", text: "Web app" },
    { key: "desktop", text: "Desktop app" },
  ];

  return (
    <Dropdown
      label="Open links in:"
      options={entries}
      openOnKeyboardFocus
      selectedKey={preference}
      onChange={(_event, option) => {
        if (option) {
          void setPreference(String(option.key));
        }
      }}
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
          void setMessageRate(option.data as number);
        }
      }}
      calloutProps={{
        directionalHint: DirectionalHint.bottomLeftEdge,
        directionalHintFixed: true,
      }}
    />
  );
}

function AutoUpdate(): React.ReactElement {
  const [updatesEnabled = true, setUpdatedEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.UPDATES_ENABLED,
  );

  return (
    <>
      <Label>Updates:</Label>
      <Checkbox
        checked={updatesEnabled}
        label="Automatically install updates"
        onChange={(_, newValue) => {
          void setUpdatedEnabled(newValue ?? true);
        }}
      />
    </>
  );
}

function RosPackagePath(): React.ReactElement {
  const [rosPackagePath, setRosPackagePath] = useAppConfigurationValue<string>(
    AppSetting.ROS_PACKAGE_PATH,
  );

  const rosPackagePathPlaceholder = useMemo(() => os?.getEnvVar("ROS_PACKAGE_PATH"), []);

  return (
    <TextField
      label="ROS_PACKAGE_PATH"
      placeholder={rosPackagePathPlaceholder}
      value={rosPackagePath ?? ""}
      onChange={(_event, newValue) => void setRosPackagePath(newValue ? newValue : undefined)}
    />
  );
}

export default function Preferences(): React.ReactElement {
  const [crashReportingEnabled, setCrashReportingEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.CRASH_REPORTING_ENABLED,
  );
  const [telemetryEnabled, setTelemetryEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.TELEMETRY_ENABLED,
  );

  // automatic updates are a desktop-only setting
  //
  // electron-updater does not provide a way to detect if we are on a supported update platform
  // so we hard-code linux as an _unsupported_ auto-update platform since we cannot auto-update
  // with our .deb package install method on linux.
  const supportsAppUpdates = isDesktopApp() && os?.platform !== "linux";

  return (
    <SidebarContent title="Preferences">
      <Stack gap={4}>
        <section>
          <Typography component="h2" variant="h5" gutterBottom color="primary">
            General
          </Typography>
          <Stack gap={1}>
            <div>
              <ColorSchemeSettings />
            </div>
            <div>
              <TimezoneSettings />
            </div>
            <div>
              <TimeFormat />
            </div>
            <div>
              <MessageFramerate />
            </div>
            {supportsAppUpdates && (
              <div>
                <AutoUpdate />
              </div>
            )}
            {!isDesktopApp() && (
              <div>
                <LaunchDefault />
              </div>
            )}
          </Stack>
        </section>

        <section>
          <Typography component="h2" variant="h5" gutterBottom color="primary">
            ROS
          </Typography>
          <Stack gap={1}>
            <div>
              <RosPackagePath />
            </div>
          </Stack>
        </section>

        <section>
          <Typography component="h2" variant="h5" gutterBottom color="primary">
            Privacy
          </Typography>
          <Stack gap={1}>
            <Typography color="text.secondary">
              Changes will take effect the next time Foxglove Studio is launched.
            </Typography>
            <Checkbox
              checked={telemetryEnabled ?? true}
              onChange={(_event, checked) => void setTelemetryEnabled(checked)}
              label="Send anonymized usage data to help us improve Foxglove Studio"
            />
            <Checkbox
              checked={crashReportingEnabled ?? true}
              onChange={(_event, checked) => void setCrashReportingEnabled(checked)}
              label="Send anonymized crash reports"
            />
          </Stack>
        </section>

        <section>
          <Typography component="h2" variant="h5" gutterBottom color="primary">
            Experimental features
          </Typography>
          <Stack gap={1}>
            <Typography color="text.secondary">
              These features are unstable and not recommended for daily use.
            </Typography>
            <ExperimentalFeatureSettings />
          </Stack>
        </section>
      </Stack>
    </SidebarContent>
  );
}
