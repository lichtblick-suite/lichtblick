// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Card, CardContent, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
});

/**
 * Message indiciating the panel is too old to be used with the current version of a configuration.
 */
export function PanelConfigVersionError(): JSX.Element {
  const { t } = useTranslation("panelConfigVersionGuard");

  const { classes } = useStyles();

  return (
    <Paper className={classes.root}>
      <Card>
        <CardContent>
          <Typography variant="subtitle1">{t("warning")}</Typography>
          <Typography variant="subtitle1">{t("instructions")}</Typography>
        </CardContent>
      </Card>
    </Paper>
  );
}
