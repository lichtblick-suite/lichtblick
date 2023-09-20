// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Divider, Paper } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles<void, "selected">()((theme, _props, classes) => ({
  selected: {},
  root: {
    display: "flex",
    borderRadius: "1em",
    color: theme.palette.action.selected,
    borderColor: "currentColor",
    backgroundColor: theme.palette.background.paper,

    [`@container (max-width: 320px)`]: {
      display: "none",
    },
    ...(theme.palette.mode === "dark" && {
      [`&.${classes.selected}`]: { color: theme.palette.primary.main },
    }),
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
    borderColor: "currentColor",
    marginInline: theme.spacing(0.5),
  },
}));

export function TopicStatsChip({
  topicName,
  selected,
}: {
  topicName: string;
  selected: boolean;
}): JSX.Element {
  const { classes, cx } = useStyles();

  return (
    <Paper variant="outlined" className={cx(classes.root, { [classes.selected]: selected })}>
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
