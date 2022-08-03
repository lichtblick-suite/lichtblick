// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Autocomplete,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import moment from "moment-timezone";
import { useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { filterMap } from "@foxglove/den/collection";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import { ExperimentalFeatureSettings } from "@foxglove/studio-base/components/ExperimentalFeatureSettings";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { TimeDisplayMethod } from "@foxglove/studio-base/types/panels";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const MESSAGE_RATES = [1, 3, 5, 10, 15, 20, 30, 60];

const os = OsContextSingleton; // workaround for https://github.com/webpack/webpack/issues/12960

const useStyles = makeStyles()({
  autocompleteInput: {
    "&.MuiOutlinedInput-input": {
      padding: 0,
    },
  },
  checkbox: {
    "&.MuiCheckbox-root": {
      paddingTop: 0,
    },
  },
  formControlLabel: {
    "&.MuiFormControlLabel-root": {
      alignItems: "start",
    },
  },
});

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
  const options = useMemo(
    () => [
      { key: "light", text: "Light", iconProps: { iconName: "WeatherSunny" } },
      { key: "dark", text: "Dark", iconProps: { iconName: "WeatherMoon" } },
      { key: "system", text: "Follow system", iconProps: { iconName: "CircleHalfFill" } },
    ],
    [],
  );
  return (
    <Stack>
      <FormLabel>Color scheme:</FormLabel>
      <Select
        value={colorScheme}
        fullWidth
        onChange={(event) => void setColorScheme(event.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option.key} value={option.key}>
            {option.text}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
}

function TimezoneSettings(): React.ReactElement {
  type Option = { key: string; label: string; data?: string; divider?: boolean };

  const { classes } = useStyles();

  const [timezone, setTimezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);
  const detectItem: Option = useMemo(
    () => ({
      key: "detect",
      label: `Detect from system: ${formatTimezone(moment.tz.guess())}`,
      data: undefined,
    }),
    [],
  );
  const fixedItems: Option[] = useMemo(
    () => [
      detectItem,
      { key: "zone:UTC", label: `${formatTimezone("UTC")}`, data: "UTC" },
      {
        key: "sep",
        label: "",
        divider: true,
      },
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
        return { key: `zone:${name}`, label: formatTimezone(name), data: name };
      }),
    [],
  );

  const allItems = useMemo(() => [...fixedItems, ...timezoneItems], [fixedItems, timezoneItems]);

  const selectedItem = useMemo(
    () => (timezone != undefined && allItems.find((item) => item.key === timezone)) || detectItem,
    [allItems, detectItem, timezone],
  );

  return (
    <FormControl fullWidth>
      <Typography color="text.secondary" marginBottom={0.5}>
        Display timestamps in:
      </Typography>
      <Autocomplete
        options={[...fixedItems, ...timezoneItems]}
        value={selectedItem}
        renderOption={(props, option: Option) =>
          option.divider === true ? (
            <Divider />
          ) : (
            <li {...props} key={option.key}>
              {option.label}
            </li>
          )
        }
        renderInput={(params) => (
          <TextField
            {...params}
            inputProps={{ ...params.inputProps, className: classes.autocompleteInput }}
          />
        )}
        onChange={(_event, value) => void setTimezone(value ? String(value.key) : undefined)}
      />
    </FormControl>
  );
}

function TimeFormat(): React.ReactElement {
  const { timeFormat, setTimeFormat } = useAppTimeFormat();
  const options: Array<{ key: TimeDisplayMethod; text: string }> = [
    { key: "SEC", text: "Seconds" },
    { key: "TOD", text: "Local" },
  ];

  return (
    <Stack>
      <FormLabel>Timestamp format:</FormLabel>
      <Select
        value={timeFormat}
        fullWidth
        onChange={(event) => void setTimeFormat(event.target.value as TimeDisplayMethod)}
      >
        {options.map((option) => (
          <MenuItem key={option.key} value={option.key}>
            {option.text}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
}

function LaunchDefault(): React.ReactElement {
  const [preference = "unknown", setPreference] = useAppConfigurationValue<string | undefined>(
    AppSetting.LAUNCH_PREFERENCE,
  );

  const options: Array<{ key: string; text: string }> = [
    { key: "unknown", text: "Ask each time" },
    { key: "web", text: "Web app" },
    { key: "desktop", text: "Desktop app" },
  ];

  return (
    <Stack>
      <FormLabel>Open links in:</FormLabel>
      <Select
        value={preference}
        fullWidth
        onChange={(event) => void setPreference(event.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option.key} value={option.key}>
            {option.text}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
}

function MessageFramerate(): React.ReactElement {
  const [messageRate, setMessageRate] = useAppConfigurationValue<number>(AppSetting.MESSAGE_RATE);
  const options = useMemo(
    () => MESSAGE_RATES.map((rate) => ({ key: rate, text: `${rate}`, data: rate })),
    [],
  );

  return (
    <Stack>
      <FormLabel>Message rate (Hz):</FormLabel>
      <Select
        value={messageRate ?? 60}
        fullWidth
        onChange={(event) => void setMessageRate(event.target.value as number)}
      >
        {options.map((option) => (
          <MenuItem key={option.key} value={option.key}>
            {option.text}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
}

function AutoUpdate(): React.ReactElement {
  const [updatesEnabled = true, setUpdatedEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.UPDATES_ENABLED,
  );

  const { classes } = useStyles();

  return (
    <>
      <Typography color="text.secondary" marginBottom={0.5}>
        Updates:
      </Typography>
      <FormControlLabel
        className={classes.formControlLabel}
        control={
          <Checkbox
            className={classes.checkbox}
            checked={updatesEnabled}
            onChange={(_event, checked) => void setUpdatedEnabled(checked)}
          />
        }
        label="Send anonymized crash reports"
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
      fullWidth
      label="ROS_PACKAGE_PATH"
      placeholder={rosPackagePathPlaceholder}
      value={rosPackagePath ?? ""}
      onChange={(event) => void setRosPackagePath(event.target.value)}
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

  const { classes } = useStyles();

  return (
    <SidebarContent title="Preferences">
      <Stack gap={4}>
        <section>
          <Typography component="h2" variant="h5" gutterBottom color="primary">
            General
          </Typography>
          <Stack gap={2}>
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
          <Stack gap={2}>
            <Typography color="text.secondary">
              Changes will take effect the next time Foxglove Studio is launched.
            </Typography>
            <FormControlLabel
              className={classes.formControlLabel}
              control={
                <Checkbox
                  className={classes.checkbox}
                  checked={telemetryEnabled ?? true}
                  onChange={(_event, checked) => void setTelemetryEnabled(checked)}
                />
              }
              label="Send anonymized usage data to help us improve Foxglove Studio"
            />
            <FormControlLabel
              className={classes.formControlLabel}
              control={
                <Checkbox
                  className={classes.checkbox}
                  checked={crashReportingEnabled ?? true}
                  onChange={(_event, checked) => void setCrashReportingEnabled(checked)}
                />
              }
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
