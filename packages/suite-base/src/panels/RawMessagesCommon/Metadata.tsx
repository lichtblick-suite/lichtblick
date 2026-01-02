// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

import CopyButton from "@lichtblick/suite-base/components/CopyButton";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useStylesMetadata } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import { PropsMetadata } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import { getMessageDocumentationLink } from "@lichtblick/suite-base/panels/RawMessagesCommon/utils";
import { formatTimeRaw } from "@lichtblick/suite-base/util/time";

import { copyMessageReplacer } from "./copyMessageReplacer";

export default function Metadata({
  data,
  diffData,
  diff,
  datatype,
  message,
  diffMessage,
}: PropsMetadata): React.JSX.Element {
  const { classes } = useStylesMetadata();

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
          {(() => {
            if (diffMessage) {
              return "base";
            }
            if (docsLink) {
              return (
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
              );
            }
            return datatype;
          })()}
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
