// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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
import { useCallback } from "react";
import { useLatest } from "react-use";
import { makeStyles } from "tss-react/mui";

import CopyButton from "@lichtblick/suite-base/components/CopyButton";
import Stack from "@lichtblick/suite-base/components/Stack";
import { MessageEvent } from "@lichtblick/suite-base/players/types";
import { formatTimeRaw } from "@lichtblick/suite-base/util/time";

import { copyMessageReplacer } from "./copyMessageReplacer";
import { getMessageDocumentationLink } from "./utils";

const useStyles = makeStyles()((theme) => ({
  button: {
    padding: theme.spacing(0.125),

    ".MuiSvgIcon-root": {
      fontSize: `${theme.typography.pxToRem(16)} !important`,
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
  message: MessageEvent;
  diffMessage?: MessageEvent;
};

export default function Metadata({
  data,
  diffData,
  diff,
  datatype,
  message,
  diffMessage,
}: Props): React.JSX.Element {
  const { classes } = useStyles();

  // Access these by ref so that our callbacks aren't invalidated and CopyButton
  // memoization is stable.
  const latestData = useLatest(data);
  const latestDiffData = useLatest(diffData);

  const docsLink = datatype ? getMessageDocumentationLink(datatype) : undefined;
  const copyData = useCallback(
    () => JSON.stringify(latestData.current, copyMessageReplacer, 2) ?? "",
    [latestData],
  );
  const copyDiffData = useCallback(
    () => JSON.stringify(latestDiffData.current, copyMessageReplacer, 2) ?? "",
    [latestDiffData],
  );
  const copyDiff = useCallback(() => JSON.stringify(diff, copyMessageReplacer, 2) ?? "", [diff]);

  return (
    <Stack alignItems="flex-start" paddingInline={0.25} paddingBlockStart={0.75}>
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
        <CopyButton size="small" iconSize="small" className={classes.button} getText={copyData} />
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
              iconSize="small"
              className={classes.button}
              getText={copyDiffData}
            />
          </Stack>
          <CopyButton size="small" iconSize="small" className={classes.button} getText={copyDiff}>
            Copy diff of msgs
          </CopyButton>
        </>
      )}
    </Stack>
  );
}
