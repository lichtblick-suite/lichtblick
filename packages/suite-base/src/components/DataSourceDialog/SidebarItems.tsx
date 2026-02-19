// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Button, Typography } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DataSourceDialogItem } from "@lichtblick/suite-base/components/DataSourceDialog/DataSourceDialog";
import DontShowThisAgainCheckbox from "@lichtblick/suite-base/components/DataSourceDialog/DontShowThisAgainCheckbox";
import { useStyles } from "@lichtblick/suite-base/components/DataSourceDialog/index.style";
import { SidebarItem } from "@lichtblick/suite-base/components/DataSourceDialog/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { LICHTBLICK_DOCUMENTATION_LINK } from "@lichtblick/suite-base/constants/documentation";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentUser } from "@lichtblick/suite-base/context/BaseUserContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";

const SidebarItems = (props: {
  onSelectView: (newValue: DataSourceDialogItem) => void;
}): React.JSX.Element => {
  const { onSelectView } = props;
  const { currentUserType } = useCurrentUser();
  const analytics = useAnalytics();
  const { classes } = useStyles();
  const { t } = useTranslation("openDialog");

  const { freeUser, teamOrEnterpriseUser } = useMemo(() => {
    const demoItem = {
      id: "new",
      title: t("newToLichtblick"),
      text: t("newToLichtblickDescription"),
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
          <Button
            onClick={() => {
              window.open(LICHTBLICK_DOCUMENTATION_LINK, "_blank", "noopener,noreferrer");
            }}
            className={classes.button}
            variant="outlined"
          >
            {t("viewDocumentation")}
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
    <Stack fullHeight direction="column" justifyContent="space-between">
      <Stack>
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
      </Stack>
      <DontShowThisAgainCheckbox />
    </Stack>
  );
};

export default SidebarItems;
