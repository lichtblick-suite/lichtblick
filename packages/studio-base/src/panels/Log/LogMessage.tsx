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

import { mergeStyleSets } from "@fluentui/react";
import cx from "classnames";
import { padStart } from "lodash";

import useLogStyles from "@foxglove/studio-base/panels/Log/useLogStyles";
import { TimeDisplayMethod } from "@foxglove/studio-base/types/panels";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import LevelToString from "./LevelToString";
import Stamp from "./Stamp";
import { NormalizedLogMessage } from "./types";

const classes = mergeStyleSets({
  root: {
    // Subsequent lines are indented bu using left padding, so we undo the padding for the first line
    // with textIndent
    textIndent: "-20px",
    paddingLeft: "20px",
    whiteSpace: "pre-wrap",
    paddingTop: "1px",
    paddingBottom: "1px",
    lineHeight: "1",
    fontFamily: fonts.MONOSPACE,
  },
});

export default React.memo(function LogMessage(props: {
  value: NormalizedLogMessage;
  timestampFormat: TimeDisplayMethod;
  timeZone: string | undefined;
}) {
  const { value: msg, timestampFormat, timeZone } = props;

  const altStr = `${msg.file}:${msg.line}`;
  const strLevel = LevelToString(msg.level);
  const stamp = msg.stamp;

  // the first message line is rendered with the info/stamp/name
  // following newlines are rendered on their own line
  const lines = msg.message.split("\n");
  const logStyles = useLogStyles();

  return (
    <div
      title={altStr}
      className={cx(classes.root, {
        [logStyles.fatal]: strLevel === "FATAL",
        [logStyles.error]: strLevel === "ERROR",
        [logStyles.warn]: strLevel === "WARN",
        [logStyles.info]: strLevel === "INFO",
        [logStyles.debug]: strLevel === "DEBUG",
      })}
    >
      <div>
        <span>[{padStart(strLevel, 5, " ")}]</span>
        <span>
          [<Stamp stamp={stamp} timestampFormat={timestampFormat} timeZone={timeZone} />]
        </span>
        {msg.name != undefined && <span>[{msg.name}]:</span>}
        <span>&nbsp;</span>
        <span>{lines[0]}</span>
      </div>
      {/* extra lines */}
      <div>
        {/* using array index as key is desired here since the index does not change */}
        {lines.slice(1).map((line, idx) => {
          return (
            <div key={idx}>
              &nbsp;&nbsp;&nbsp;&nbsp;
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
});
