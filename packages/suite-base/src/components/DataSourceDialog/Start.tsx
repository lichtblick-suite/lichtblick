// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Link, List, ListItem, ListItemButton, SvgIcon, Typography } from "@mui/material";
import { ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { DataSourceDialogItem } from "@lichtblick/suite-base/components/DataSourceDialog/DataSourceDialog";
import LichtblickLogoText from "@lichtblick/suite-base/components/LichtblickLogoText";
import Stack from "@lichtblick/suite-base/components/Stack";
import TextMiddleTruncate from "@lichtblick/suite-base/components/TextMiddleTruncate";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentUser } from "@lichtblick/suite-base/context/BaseUserContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";

const useStyles = makeStyles()((theme) => ({
  logo: {
    width: 212,
    height: "auto",
    marginLeft: theme.spacing(-1),
  },
  grid: {
    [theme.breakpoints.up("md")]: {
      display: "grid",
      gridTemplateAreas: `
        "header spacer"
        "content sidebar"
      `,
      gridTemplateRows: `content auto`,
      gridTemplateColumns: `1fr 375px`,
    },
  },
  header: {
    padding: theme.spacing(6),
    gridArea: "header",

    [theme.breakpoints.down("md")]: {
      padding: theme.spacing(4),
    },
    [`@media (max-height: ${theme.breakpoints.values.sm})`]: {
      display: "none",
    },
  },
  content: {
    padding: theme.spacing(0, 6, 6),
    overflow: "hidden",
    gridArea: "content",

    [theme.breakpoints.down("md")]: {
      padding: theme.spacing(0, 4, 4),
    },
    [`@media (max-height: ${theme.breakpoints.values.sm})`]: {
      paddingTop: theme.spacing(6),
    },
  },
  spacer: {
    gridArea: "spacer",
    backgroundColor: tinycolor(theme.palette.text.primary).setAlpha(0.04).toRgbString(),

    [`@media (max-height: ${theme.breakpoints.values.sm})`]: {
      display: "none",
    },
  },
  sidebar: {
    gridArea: "sidebar",
    backgroundColor: tinycolor(theme.palette.text.primary).setAlpha(0.04).toRgbString(),
    padding: theme.spacing(0, 5, 5),

    [theme.breakpoints.down("md")]: {
      padding: theme.spacing(4),
    },
    [`@media (max-height: ${theme.breakpoints.values.sm})`]: {
      paddingTop: theme.spacing(6),
    },
  },
  button: {
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  connectionButton: {
    textAlign: "left",
    justifyContent: "flex-start",
    padding: theme.spacing(2, 3),
    gap: theme.spacing(1.5),
    borderColor: theme.palette.divider,

    ".MuiButton-startIcon .MuiSvgIcon-fontSizeLarge": {
      fontSize: 28,
    },
  },
  recentListItemButton: {
    overflow: "hidden",
    color: theme.palette.primary.main,

    "&:hover": {
      backgroundColor: "transparent",
      color: theme.palette.primary[theme.palette.mode === "dark" ? "light" : "dark"],
    },
  },
  recentSourceSecondary: {
    color: "inherit",
  },
}));

type DataSourceOptionProps = {
  text: string;
  secondaryText: string;
  icon: React.JSX.Element;
  onClick: () => void;
  href?: string;
  target: "_blank";
};

function DataSourceOption(props: DataSourceOptionProps): React.JSX.Element {
  const { icon, onClick, text, secondaryText, href, target } = props;
  const { classes } = useStyles();
  const button = (
    <Button
      className={classes.connectionButton}
      fullWidth
      color="inherit"
      variant="outlined"
      startIcon={icon}
      onClick={onClick}
    >
      <Stack flex="auto" zeroMinWidth>
        <Typography variant="subtitle1" color="text.primary">
          {text}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {secondaryText}
        </Typography>
      </Stack>
    </Button>
  );

  return href ? (
    <Link href={href} target={target} style={{ textDecoration: "none" }}>
      {button}
    </Link>
  ) : (
    button
  );
}

type SidebarItem = {
  id: string;
  title: string;
  text: ReactNode;
  actions?: ReactNode;
};

function SidebarItems(props: {
  onSelectView: (newValue: DataSourceDialogItem) => void;
}): React.JSX.Element {
  const { onSelectView } = props;
  const { currentUserType } = useCurrentUser();
  const analytics = useAnalytics();
  const { classes } = useStyles();
  const { t } = useTranslation("openDialog");

  const { freeUser, teamOrEnterpriseUser } = useMemo(() => {
    const demoItem = {
      id: "new",
      title: t("newToFoxgloveStudio"),
      text: t("newToFoxgloveStudioDescription"),
      actions: (
        <>
          <Button
            onClick={() => {
              onSelectView("demo");
              void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, { type: "demo" });
              void analytics.logEvent(AppEvent.DIALOG_CLICK_CTA, {
                user: currentUserType,
                cta: "demo",
              });
            }}
            className={classes.button}
            variant="outlined"
          >
            {t("exploreSampleData")}
          </Button>
        </>
      ),
    };
    return {
      freeUser: [demoItem],
      teamOrEnterpriseUser: [
        demoItem,
        {
          id: "need-help",
          title: t("needHelp"),
          text: t("needHelpDescription"),
          actions: (
            <>
              <Button
                href="https://foxglove.dev/tutorials"
                target="_blank"
                className={classes.button}
                onClick={() => {
                  void analytics.logEvent(AppEvent.DIALOG_CLICK_CTA, {
                    user: currentUserType,
                    cta: "tutorials",
                  });
                }}
              >
                {t("seeTutorials")}
              </Button>
            </>
          ),
        },
      ],
    };
  }, [analytics, classes.button, currentUserType, onSelectView, t]);

  const sidebarItems: SidebarItem[] = useMemo(() => {
    switch (currentUserType) {
      case "unauthenticated":
        return [...freeUser];
      case "authenticated-free":
        return [
          {
            id: "start-collaborating",
            title: t("startCollaborating"),
            text: t("startCollaboratingDescription"),
            actions: (
              <>
                <Button
                  href="https://console.foxglove.dev/recordings"
                  target="_blank"
                  variant="outlined"
                  className={classes.button}
                  onClick={() => {
                    void analytics.logEvent(AppEvent.DIALOG_CLICK_CTA, {
                      user: currentUserType,
                      cta: "upload-to-dp",
                    });
                  }}
                >
                  {t("uploadToDataPlatform")}
                </Button>
                <Button
                  href="https://docs.foxglove.dev/docs/visualization/layouts#team-layouts"
                  target="_blank"
                  className={classes.button}
                >
                  {t("shareLayouts")}
                </Button>
              </>
            ),
          },
          ...freeUser,
        ];
      case "authenticated-team":
        return teamOrEnterpriseUser;
      case "authenticated-enterprise":
        return teamOrEnterpriseUser;
    }
  }, [analytics, classes.button, currentUserType, freeUser, teamOrEnterpriseUser, t]);

  return (
    <>
      {sidebarItems.map((item) => (
        <Stack key={item.id}>
          <Typography variant="h5" gutterBottom>
            {item.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {item.text}
          </Typography>
          {item.actions != undefined && (
            <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} paddingTop={1.5}>
              {item.actions}
            </Stack>
          )}
        </Stack>
      ))}
    </>
  );
}

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
        text: t("openLocalFile"),
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
