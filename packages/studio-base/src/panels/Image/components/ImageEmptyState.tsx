// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Stack from "@foxglove/studio-base/components/Stack";

type Props = {
  cameraTopic: string;
  markerTopics: readonly string[];
  shouldSynchronize: boolean;
};

export function ImageEmptyState(props: Props): JSX.Element {
  const { cameraTopic, markerTopics, shouldSynchronize } = props;

  if (cameraTopic === "") {
    return (
      <Stack fullHeight fullWidth justifyContent="center" alignItems="center" position="absolute">
        <EmptyState>Select a topic to view images</EmptyState>
      </Stack>
    );
  }
  return (
    <Stack fullHeight fullWidth justifyContent="center" alignItems="center" position="absolute">
      <EmptyState>
        <Typography variant="body2" color="text.secondary" gutterBottom>
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
          <Typography variant="body2" color="text.secondary">
            Synchronization is enabled, so all messages must have the same timestamp.
          </Typography>
        )}
      </EmptyState>
    </Stack>
  );
}
