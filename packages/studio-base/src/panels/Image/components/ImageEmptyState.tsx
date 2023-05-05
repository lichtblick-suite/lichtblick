// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import EmptyState from "@foxglove/studio-base/components/EmptyState";

type Props = {
  cameraTopic: string;
  markerTopics: readonly string[];
  shouldSynchronize: boolean;
};

const useStyles = makeStyles()({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});

export function ImageEmptyState(props: Props): JSX.Element {
  const { cameraTopic, markerTopics, shouldSynchronize } = props;
  const { classes } = useStyles();

  if (cameraTopic === "") {
    return <EmptyState className={classes.root}>Select a topic to view images</EmptyState>;
  }
  return (
    <EmptyState className={classes.root}>
      <Typography variant="inherit" gutterBottom>
        Waiting for images {markerTopics.length > 0 && "and markers"} on:
      </Typography>
      <Typography component="code" variant="inherit" display="block">
        {cameraTopic}
      </Typography>
      {[...markerTopics].sort().map((topic) => (
        <Typography key={topic} component="code" variant="inherit" display="block">
          {topic}
        </Typography>
      ))}
      {shouldSynchronize && (
        <Typography variant="inherit">
          Synchronization is enabled, so all messages must have the same timestamp.
        </Typography>
      )}
    </EmptyState>
  );
}
