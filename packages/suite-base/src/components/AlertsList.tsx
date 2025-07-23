// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ErrorCircle16Regular, Info16Regular, Warning16Regular } from "@fluentui/react-icons";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Typography,
  accordionSummaryClasses,
  useTheme,
} from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import Stack from "@lichtblick/suite-base/components/Stack";
import { AlertsContextStore, useAlertsStore } from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";
import { DetailsType, NotificationSeverity } from "@lichtblick/suite-base/util/sendNotification";
import { customTypography } from "@lichtblick/theme";

const useStyles = makeStyles()((theme) => ({
  acccordion: {
    background: "none",
    boxShadow: "none",
    borderBottom: `1px solid ${theme.palette.divider}`,

    "&:before": {
      display: "none",
    },
    "&.Mui-expanded": {
      margin: 0,
    },
  },
  accordionDetails: {
    display: "flex",
    flexDirection: "column",
    fontFamily: customTypography.fontMonospace,
    fontSize: "0.6875rem",
    padding: theme.spacing(1.125),
    gap: theme.spacing(1),
  },
  acccordionSummary: {
    height: 30,
    minHeight: "auto",
    padding: theme.spacing(0, 0.5, 0, 0.75),
    fontWeight: 500,

    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    "&.Mui-expanded": {
      minHeight: "auto",
    },
    [`& .${accordionSummaryClasses.content}`]: {
      gap: theme.spacing(0.5),
      overflow: "hidden",
      alignItems: "center",
      margin: "0 !important",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}`]: {
      transform: "rotate(-90deg)",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}.Mui-expanded`]: {
      transform: "rotate(0deg)",
    },
  },
  detailsText: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    maxHeight: "30vh",
    overflow: "auto",
    flex: 1,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(1),
  },
  icon: {
    flex: "none",
  },
}));

const EMPTY_PLAYER_ALERTS: PlayerAlert[] = [];
const selectPlayerAlerts = ({ playerState }: MessagePipelineContext) =>
  playerState.alerts ?? EMPTY_PLAYER_ALERTS;
const selectAlerts = (store: AlertsContextStore) => store.alerts;

function AlertIcon({ severity }: { severity: NotificationSeverity }): React.JSX.Element {
  const { palette } = useTheme();
  const { classes } = useStyles();

  switch (severity) {
    case "warn":
      return <Warning16Regular className={classes.icon} primaryFill={palette.warning.main} />;
    case "error":
      return <ErrorCircle16Regular className={classes.icon} primaryFill={palette.error.main} />;
    case "info":
      return <Info16Regular className={classes.icon} primaryFill={palette.info.main} />;
    default:
      return <></>;
  }
}

function AlertDetails(props: { details: DetailsType; tip?: string }): React.JSX.Element {
  const { t } = useTranslation("alertsList");
  const { details, tip } = props;
  const { classes } = useStyles();

  const content = useMemo(() => {
    if (details instanceof Error) {
      return <div className={classes.detailsText}>{details.message}</div>;
    } else if (details != undefined && details !== "") {
      return (
        <Typography style={{ whiteSpace: "pre-line" /* allow newlines in the details message */ }}>
          {details}
        </Typography>
      );
    } else if (tip != undefined && tip !== "") {
      return undefined;
    }

    return t("noDetailsProvided");
  }, [classes, details, tip, t]);

  return (
    <AccordionDetails className={classes.accordionDetails}>
      {tip && <div>{tip}</div>}
      {content}
    </AccordionDetails>
  );
}

export function AlertsList(): React.JSX.Element {
  const { t } = useTranslation("alertsList");
  const { classes } = useStyles();
  const playerAlerts = useMessagePipeline(selectPlayerAlerts);
  const sessionAlerts = useAlertsStore(selectAlerts);

  const allAlerts = useMemo(() => {
    return [...sessionAlerts, ...playerAlerts];
  }, [sessionAlerts, playerAlerts]);

  if (allAlerts.length === 0) {
    return <EmptyState>{t("noAlertsFound")}</EmptyState>;
  }

  return (
    <Stack fullHeight flex="auto" overflow="auto">
      {allAlerts.map((alert, idx) => (
        <Accordion
          className={classes.acccordion}
          key={`${idx}.${alert.severity}.${alert.message}`}
          slotProps={{ transition: { unmountOnExit: true } }}
          defaultExpanded
        >
          <AccordionSummary
            className={classes.acccordionSummary}
            expandIcon={<ArrowDropDownIcon />}
            title={alert.message}
          >
            <AlertIcon severity={alert.severity} />
            <Typography variant="inherit" noWrap>
              {alert.message}
            </Typography>
          </AccordionSummary>
          <Divider />
          <AlertDetails details={alert.error} tip={alert.tip} />
        </Accordion>
      ))}
    </Stack>
  );
}
