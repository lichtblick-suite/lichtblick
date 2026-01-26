// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { List, ListItem, ListItemButton, SvgIcon, Typography } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import DataSourceOption from "@lichtblick/suite-base/components/DataSourceDialog/DataSourceOption";
import SidebarItems from "@lichtblick/suite-base/components/DataSourceDialog/SidebarItems";
import { useStyles } from "@lichtblick/suite-base/components/DataSourceDialog/index.style";
import LichtblickLogoText from "@lichtblick/suite-base/components/LichtblickLogoText";
import Stack from "@lichtblick/suite-base/components/Stack";
import TextMiddleTruncate from "@lichtblick/suite-base/components/TextMiddleTruncate";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";

export default function Start(): React.JSX.Element {
  const { recentSources, selectRecent } = usePlayerSelection();
  const { classes } = useStyles();
  const analytics = useAnalytics();
  const { t } = useTranslation("openDialog");
  const { dialogActions } = useWorkspaceActions();

  const startItems = useMemo(() => {
    return [
      {
        key: "open-local-file",
        text: t("openLocalFiles"),
        secondaryText: t("openLocalFileDescription"),
        icon: (
          <SvgIcon fontSize="large" color="primary" viewBox="0 0 2048 2048">
            <path d="M1955 1533l-163-162v677h-128v-677l-163 162-90-90 317-317 317 317-90 90zM256 1920h1280v128H128V0h1115l549 549v475h-128V640h-512V128H256v1792zM1280 512h293l-293-293v293z" />
          </SvgIcon>
        ),
        onClick: () => {
          dialogActions.dataSource.open("file");
          void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, { type: "local" });
        },
      },
      {
        key: "open-connection",
        text: t("openConnection"),
        secondaryText: t("openConnectionDescription"),
        icon: (
          <SvgIcon fontSize="large" color="primary" viewBox="0 0 2048 2048">
            <path d="M1408 256h640v640h-640V640h-120l-449 896H640v256H0v-640h640v256h120l449-896h199V256zM512 1664v-384H128v384h384zm1408-896V384h-384v384h384z" />
          </SvgIcon>
        ),
        onClick: () => {
          dialogActions.dataSource.open("connection");
          void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, { type: "live" });
        },
      },
    ];
  }, [analytics, dialogActions.dataSource, t]);

  return (
    <Stack className={classes.grid}>
      <header className={classes.header}>
        <LichtblickLogoText color="primary" className={classes.logo} />
      </header>
      <Stack className={classes.content}>
        <Stack gap={4}>
          <Stack gap={1}>
            <Typography variant="h5" gutterBottom>
              {t("openDataSource")}
            </Typography>
            {startItems.map((item) => (
              <DataSourceOption
                key={item.key}
                text={item.text}
                secondaryText={item.secondaryText}
                icon={item.icon}
                onClick={item.onClick}
                target="_blank"
              />
            ))}
          </Stack>
          {recentSources.length > 0 && (
            <Stack gap={1}>
              <Typography variant="h5" gutterBottom>
                {t("recentDataSources")}
              </Typography>
              <List disablePadding>
                {recentSources.slice(0, 5).map((recent) => (
                  <ListItem disablePadding key={recent.id} id={recent.id}>
                    <ListItemButton
                      disableGutters
                      onClick={() => {
                        selectRecent(recent.id);
                      }}
                      className={classes.recentListItemButton}
                    >
                      <TextMiddleTruncate
                        className={classes.recentSourceSecondary}
                        text={recent.title}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Stack>
          )}
        </Stack>
      </Stack>
      <div className={classes.spacer} />
      <Stack gap={4} className={classes.sidebar}>
        <SidebarItems onSelectView={dialogActions.dataSource.open} />
      </Stack>
    </Stack>
  );
}
