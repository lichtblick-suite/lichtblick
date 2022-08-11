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
import { CardActionArea, Typography } from "@mui/material";

import type { LayoutActions } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";

type Props = {
  topic: string;
  addPanel: LayoutActions["addPanel"];
};

export default function TopicLink({ addPanel, topic }: Props): JSX.Element {
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
    <CardActionArea onClick={openRawMessages} title="Open in Raw Message panel">
      <Stack direction="row" alignItems="center" justifyContent="space-between" padding={1}>
        <Typography variant="body2">{topic}</Typography>
        <OpenInNewIcon fontSize="small" color="primary" />
      </Stack>
    </CardActionArea>
  );
}
