// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogProps,
  DialogTitle,
  FormControlLabel,
  FormLabel,
  IconButton,
  Link,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { MouseEvent, SyntheticEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useStyles } from "@lichtblick/suite-base/components/AppSettingsDialog/AppSettingsDialog.style";
import { APP_SETTINGS_ABOUT_ITEMS } from "@lichtblick/suite-base/components/AppSettingsDialog/constants";
import { AppSettingsTab } from "@lichtblick/suite-base/components/AppSettingsDialog/types";
import CopyButton from "@lichtblick/suite-base/components/CopyButton";
import { ExperimentalFeatureSettings } from "@lichtblick/suite-base/components/ExperimentalFeatureSettings";
import ExtensionsSettings from "@lichtblick/suite-base/components/ExtensionsSettings";
import LichtblickLogoText from "@lichtblick/suite-base/components/LichtblickLogoText";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAppContext } from "@lichtblick/suite-base/context/AppContext";
import {
  useWorkspaceStore,
  WorkspaceContextStore,
} from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

import {
  AutoUpdate,
  ColorSchemeSettings,
  LanguageSettings,
  LaunchDefault,
  MessageFramerate,
  StepSize,
  RosPackagePath,
  TimeFormat,
  TimezoneSettings,
} from "./settings";

const selectWorkspaceInitialActiveTab = (store: WorkspaceContextStore) =>
  store.dialogs.preferences.initialTab;

export function AppSettingsDialog(
  props: DialogProps & { activeTab?: AppSettingsTab },
): React.JSX.Element {
  const { t } = useTranslation("appSettings");
  const { activeTab: _activeTab } = props;
  const initialActiveTab = useWorkspaceStore(selectWorkspaceInitialActiveTab);
  const [activeTab, setActiveTab] = useState<AppSettingsTab>(
    _activeTab ?? initialActiveTab ?? "general",
  );
  const [debugModeEnabled = false, setDebugModeEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_DEBUG_PANELS,
  );
  const { classes, cx, theme } = useStyles();
  const smUp = useMediaQuery(theme.breakpoints.up("sm"));

  const { extensionSettings } = useAppContext();

  // automatic updates are a desktop-only setting
  const supportsAppUpdates = isDesktopApp();

  const handleTabChange = (_event: SyntheticEvent, newValue: AppSettingsTab) => {
    setActiveTab(newValue);
  };

  const handleClose = (event: MouseEvent<HTMLElement>) => {
    if (props.onClose != undefined) {
      props.onClose(event, "backdropClick");
    }
  };

  const extensionSettingsComponent = extensionSettings ?? <ExtensionsSettings />;

  return (
    <Dialog {...props} fullWidth maxWidth="md" data-testid={`AppSettingsDialog--${activeTab}`}>
      <DialogTitle className={classes.dialogTitle}>
        {t("settings")}
        <IconButton edge="end" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <div className={classes.layoutGrid}>
        <Tabs
          classes={{ indicator: classes.indicator }}
          value={activeTab}
          orientation={smUp ? "vertical" : "horizontal"}
          onChange={handleTabChange}
        >
          <Tab className={classes.tab} label={t("general")} value="general" />
          <Tab className={classes.tab} label={t("extensions")} value="extensions" />
          <Tab
            className={classes.tab}
            label={t("experimentalFeatures")}
            value="experimental-features"
          />
          <Tab className={classes.tab} label={t("about")} value="about" />
        </Tabs>
        <Stack direction="row" fullHeight overflowY="auto">
          <section
            className={cx(classes.tabPanel, {
              [classes.tabPanelActive]: activeTab === "general",
            })}
          >
            <Stack gap={2}>
              <ColorSchemeSettings />
              <TimezoneSettings />
              <TimeFormat orientation={smUp ? "horizontal" : "vertical"} />
              <MessageFramerate />
              <StepSize />
              <LanguageSettings />
              {supportsAppUpdates && <AutoUpdate />}
              {!isDesktopApp() && <LaunchDefault />}
              {isDesktopApp() && <RosPackagePath />}
              <Stack>
                <FormLabel>{t("advanced")}:</FormLabel>
                <FormControlLabel
                  className={classes.formControlLabel}
                  control={
                    <Checkbox
                      className={classes.checkbox}
                      checked={debugModeEnabled}
                      onChange={(_, checked) => {
                        void setDebugModeEnabled(checked);
                      }}
                    />
                  }
                  label={t("debugModeDescription")}
                />
              </Stack>
            </Stack>
          </section>

          <section
            className={cx(classes.tabPanel, {
              [classes.tabPanelActive]: activeTab === "extensions",
            })}
          >
            <Stack gap={2}>{extensionSettingsComponent}</Stack>
          </section>

          <section
            className={cx(classes.tabPanel, {
              [classes.tabPanelActive]: activeTab === "experimental-features",
            })}
          >
            <Stack gap={2}>
              <Alert color="warning" icon={<WarningAmberIcon />}>
                {t("experimentalFeaturesDescription")}
              </Alert>
              <Stack paddingLeft={2}>
                <ExperimentalFeatureSettings />
              </Stack>
            </Stack>
          </section>

          <section
            className={cx(classes.tabPanel, { [classes.tabPanelActive]: activeTab === "about" })}
          >
            <Stack gap={2} alignItems="flex-start">
              <header>
                <LichtblickLogoText color="primary" className={classes.logo} />
              </header>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="body2">
                  Lichtblick version {LICHTBLICK_SUITE_VERSION}
                </Typography>
                <CopyButton
                  size="small"
                  getText={() => LICHTBLICK_SUITE_VERSION?.toString() ?? ""}
                />
              </Stack>
              {Array.from(APP_SETTINGS_ABOUT_ITEMS.values()).map((item) => {
                return (
                  <Stack key={item.subheader} gap={1}>
                    {item.subheader && <Typography>{item.subheader}</Typography>}
                    {item.links.map((link) => (
                      <Link
                        variant="body2"
                        underline="hover"
                        key={link.title}
                        data-testid={link.title}
                        href={link.url}
                        target="_blank"
                      >
                        {link.title}
                      </Link>
                    ))}
                  </Stack>
                );
              })}
            </Stack>
          </section>
        </Stack>
      </div>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={handleClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
