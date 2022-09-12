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

import { makeStyles } from "tss-react/mui";

import Tooltip from "@foxglove/studio-base/components/Tooltip";

export const DEFAULT_END_TEXT_LENGTH = 16;

const useStyles = makeStyles()(() => ({
  STextMiddleTruncate: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "flex-start",
  },
  SStart: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flexShrink: 1,
  },
  SEnd: {
    whiteSpace: "nowrap",
    flexBasis: "content",
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
}));

type Props = {
  tooltips?: React.ReactNode[];
  text: string;
  endTextLength?: number;
  style?: {
    [attr: string]: string | number;
  };
  testShowTooltip?: boolean;
};

export default function TextMiddleTruncate({
  tooltips,
  text,
  endTextLength,
  style,
  testShowTooltip,
}: Props): React.ReactElement {
  const { classes } = useStyles();
  const startTextLen = Math.max(
    0,
    text.length -
      (endTextLength == undefined || endTextLength === 0 ? DEFAULT_END_TEXT_LENGTH : endTextLength),
  );
  const startText = text.substring(0, startTextLen);
  const endText = text.substring(startTextLen);

  const elem = (
    <div className={classes.STextMiddleTruncate} style={style}>
      <div className={classes.SStart}>{startText}</div>
      <div className={classes.SEnd}>{endText}</div>
    </div>
  );
  return (
    <Tooltip contents={tooltips} placement="top" shown={testShowTooltip}>
      {elem}
    </Tooltip>
  );
}
