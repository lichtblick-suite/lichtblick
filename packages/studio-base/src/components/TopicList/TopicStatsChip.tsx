// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Divider, Paper } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    borderColor: theme.palette.action.selected,
    borderRadius: "1em",
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.paper,

    [`@container (max-width: 320px)`]: {
      display: "none",
    },
  },
  stat: {
    whiteSpace: "nowrap",
    minWidth: "1em",
    textAlign: "center",
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
    paddingBlock: theme.spacing(0.25),
    fontFeatureSettings: `${theme.typography.fontFeatureSettings}, 'tnum'`,

    "&:nth-child(1)": {
      paddingInlineStart: theme.spacing(0.75),
    },
    "&:nth-last-child(1)": {
      paddingInlineEnd: theme.spacing(0.75),
    },
  },
  divider: {
    borderColor: theme.palette.action.selected,
    marginInline: theme.spacing(0.5),
  },
}));

export function TopicStatsChip({ topicName }: { topicName: string }): JSX.Element {
  const { classes } = useStyles();

  return (
    <Paper variant="outlined" className={classes.root}>
      <div className={classes.stat} data-topic={topicName} data-topic-stat="frequency">
        &ndash;
      </div>
      <Divider className={classes.divider} orientation="vertical" flexItem />
      <div className={classes.stat} data-topic={topicName} data-topic-stat="count">
        &ndash;
      </div>
    </Paper>
  );
}
