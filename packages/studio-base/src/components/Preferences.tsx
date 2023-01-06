// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Brightness5Icon from "@mui/icons-material/Brightness5";
import ComputerIcon from "@mui/icons-material/Computer";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import WebIcon from "@mui/icons-material/Web";
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
  ToggleButtonGroup,
  ToggleButton,
  ToggleButtonGroupProps,
} from "@mui/material";
import moment from "moment-timezone";
import { MouseEvent, useCallback, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { filterMap } from "@foxglove/den/collection";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import { ExperimentalFeatureSettings } from "@foxglove/studio-base/components/ExperimentalFeatureSettings";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { LaunchPreferenceValue } from "@foxglove/studio-base/types/LaunchPreferenceValue";
import { TimeDisplayMethod } from "@foxglove/studio-base/types/panels";
import { formatTime } from "@foxglove/studio-base/util/formatTime";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

const MESSAGE_RATES = [1, 3, 5, 10, 15, 20, 30, 60];

const useStyles = makeStyles()((theme) => ({
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
  toggleButton: {
    display: "flex !important",
    flexDirection: "column",
    gap: theme.spacing(0.75),
    lineHeight: "1 !important",
  },
}));

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

export function ColorSchemeSettings(): JSX.Element {
  const { classes } = useStyles();
  const [colorScheme = "system", setColorScheme] = useAppConfigurationValue<string>(
    AppSetting.COLOR_SCHEME,
  );

  const handleChange = useCallback(
    (_event: MouseEvent<HTMLElement>, value?: string) => {
      if (value != undefined) {
        void setColorScheme(value);
      }
    },
    [setColorScheme],
  );

  return (
    <Stack>
      <FormLabel>Color scheme:</FormLabel>
      <ToggleButtonGroup
        color="primary"
        size="small"
        fullWidth
        exclusive
        value={colorScheme}
        onChange={handleChange}
      >
        <ToggleButton className={classes.toggleButton} value="dark">
          <DarkModeIcon /> Dark
        </ToggleButton>
        <ToggleButton className={classes.toggleButton} value="light">
          <Brightness5Icon /> Light
        </ToggleButton>
        <ToggleButton className={classes.toggleButton} value="system">
          <ComputerIcon /> Follow system
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

export function TimezoneSettings(): React.ReactElement {
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
    () => (timezone != undefined && allItems.find((item) => item.data === timezone)) || detectItem,
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
            <Divider key={option.key} />
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
        onChange={(_event, value) => void setTimezone(value?.data)}
      />
    </FormControl>
  );
}

export function TimeFormat({
  orientation = "vertical",
}: {
  orientation?: ToggleButtonGroupProps["orientation"];
}): React.ReactElement {
  const { timeFormat, setTimeFormat } = useAppTimeFormat();

  const [timezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);

  const exampleTime = { sec: 946713600, nsec: 0 };

  return (
    <Stack>
      <FormLabel>Timestamp format:</FormLabel>
      <ToggleButtonGroup
        color="primary"
        size="small"
        orientation={orientation}
        fullWidth
        exclusive
        value={timeFormat}
        onChange={(_, value?: TimeDisplayMethod) => value != undefined && void setTimeFormat(value)}
      >
        <ToggleButton value="SEC" data-testid="timeformat-seconds">
          {formatTimeRaw(exampleTime)}
        </ToggleButton>
        <ToggleButton value="TOD" data-testid="timeformat-local">
          {formatTime(exampleTime, timezone)}
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

export function LaunchDefault(): React.ReactElement {
  const { classes } = useStyles();
  const [preference, setPreference] = useAppConfigurationValue<string | undefined>(
    AppSetting.LAUNCH_PREFERENCE,
  );
  let sanitizedPreference: LaunchPreferenceValue;
  switch (preference) {
    case LaunchPreferenceValue.WEB:
    case LaunchPreferenceValue.DESKTOP:
    case LaunchPreferenceValue.ASK:
      sanitizedPreference = preference;
      break;
    default:
      sanitizedPreference = LaunchPreferenceValue.WEB;
  }

  return (
    <Stack>
      <FormLabel>Open links in:</FormLabel>
      <ToggleButtonGroup
        color="primary"
        size="small"
        fullWidth
        exclusive
        value={sanitizedPreference}
        onChange={(_, value?: string) => value != undefined && void setPreference(value)}
      >
        <ToggleButton value={LaunchPreferenceValue.WEB} className={classes.toggleButton}>
          <WebIcon /> Web app
        </ToggleButton>
        <ToggleButton value={LaunchPreferenceValue.DESKTOP} className={classes.toggleButton}>
          <ComputerIcon /> Desktop app
        </ToggleButton>
        <ToggleButton value={LaunchPreferenceValue.ASK} className={classes.toggleButton}>
          <QuestionAnswerOutlinedIcon /> Ask each time
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

export function MessageFramerate(): React.ReactElement {
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

export function AutoUpdate(): React.ReactElement {
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
        label="Automatically install updates"
      />
    </>
  );
}

export function RosPackagePath(): React.ReactElement {
  const [rosPackagePath, setRosPackagePath] = useAppConfigurationValue<string>(
    AppSetting.ROS_PACKAGE_PATH,
  );

  const rosPackagePathPlaceholder = useMemo(
    () => OsContextSingleton?.getEnvVar("ROS_PACKAGE_PATH"),
    [],
  );

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
  const supportsAppUpdates = isDesktopApp() && OsContextSingleton?.platform !== "linux";

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
