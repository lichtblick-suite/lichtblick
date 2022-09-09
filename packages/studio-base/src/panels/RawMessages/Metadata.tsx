// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Link, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import CopyButton from "@foxglove/studio-base/components/CopyButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { copyMessageReplacer } from "./copyMessageReplacer";
import { getMessageDocumentationLink } from "./utils";

const useStyles = makeStyles()((theme) => ({
  button: {
    padding: theme.spacing(0.125),

    ".MuiSvgIcon-root": {
      fontSize: theme.typography.pxToRem(16),
    },
    ".MuiButton-startIcon": {
      marginRight: theme.spacing(0.5),
    },
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
}));

type Props = {
  data: unknown;
  diffData: unknown;
  diff: unknown;
  datatype?: string;
  message: MessageEvent<unknown>;
  diffMessage?: MessageEvent<unknown>;
};

export default function Metadata({
  data,
  diffData,
  diff,
  datatype,
  message,
  diffMessage,
}: Props): JSX.Element {
  const { classes } = useStyles();
  const docsLink = datatype ? getMessageDocumentationLink(datatype) : undefined;
  return (
    <Stack alignItems="flex-start" padding={0.25}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Typography variant="caption" lineHeight={1.2} color="text.secondary">
          {diffMessage ? (
            "base"
          ) : docsLink ? (
            <Link
              target="_blank"
              color="inherit"
              variant="caption"
              underline="hover"
              rel="noopener noreferrer"
              href={docsLink}
            >
              {datatype}
            </Link>
          ) : (
            datatype
          )}
          {` @ ${formatTimeRaw(message.receiveTime)} sec`}
        </Typography>
        <CopyButton
          size="small"
          iconSize="inherit"
          className={classes.button}
          value={JSON.stringify(data, copyMessageReplacer, 2) ?? ""}
        />
      </Stack>

      {diffMessage?.receiveTime && (
        <>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography
              variant="caption"
              lineHeight={1.2}
              color="text.secondary"
            >{`diff @ ${formatTimeRaw(diffMessage.receiveTime)} sec `}</Typography>
            <CopyButton
              size="small"
              iconSize="inherit"
              className={classes.button}
              value={JSON.stringify(diffData, copyMessageReplacer, 2) ?? ""}
            />
          </Stack>
          <CopyButton
            size="small"
            iconSize="inherit"
            className={classes.button}
            value={JSON.stringify(diff, copyMessageReplacer, 2) ?? ""}
          >
            Copy diff of msgs
          </CopyButton>
        </>
      )}
    </Stack>
  );
}
