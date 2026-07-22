// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AccordionDetails, Typography } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DetailsType } from "@lichtblick/suite-base/util/sendNotification";

import { useStyles } from "./AlertsList.style";

export function AlertDetails(
  props: Readonly<{ details: DetailsType; tip?: string }>,
): React.JSX.Element {
  const { t } = useTranslation("alertsList");
  const { details, tip } = props;
  const { classes } = useStyles();

  const content = useMemo(() => {
    if (details instanceof Error) {
      return <div className={classes.detailsText}>{details.message}</div>;
    } else if (details != undefined && details !== "") {
      return <Typography style={{ whiteSpace: "pre-line" }}>{details}</Typography>;
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
