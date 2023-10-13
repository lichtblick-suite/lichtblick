// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SettingsIcon from "@mui/icons-material/Settings";
import { IconButton, Typography } from "@mui/material";

import type { LayoutActions } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";

type Props = {
  topic: string;
  addPanel: LayoutActions["addPanel"];
  onShowTopicSettings?: (topic: string) => void;
};

export default function TopicLink({ addPanel, onShowTopicSettings, topic }: Props): JSX.Element {
  const openRawMessages = React.useCallback(() => {
    addPanel({
      position: "sibling",
      type: "RawMessages",
      updateIfExists: true,
      getState: (existingState?: unknown) => ({
        ...(existingState as Record<string, unknown> | undefined),
        topicPath: topic,
      }),
    });
  }, [addPanel, topic]);

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      paddingInlineStart={1}
      paddingBlock={0}
    >
      <Typography variant="body2">{topic}</Typography>
      <Stack direction="row" padding={0}>
        {onShowTopicSettings && (
          <IconButton
            onClick={() => {
              onShowTopicSettings(topic);
            }}
            title="Show settings"
          >
            <SettingsIcon fontSize="small" color="primary" />
          </IconButton>
        )}
        <IconButton onClick={openRawMessages} title="Open in Raw Message panel">
          <OpenInNewIcon fontSize="small" color="primary" />
        </IconButton>
      </Stack>
    </Stack>
  );
}
