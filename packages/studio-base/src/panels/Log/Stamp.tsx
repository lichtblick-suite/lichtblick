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

import { Time } from "@lichtblick/studio";
import { TimeDisplayMethod } from "@lichtblick/studio-base/types/panels";
import { formatTime } from "@lichtblick/studio-base/util/formatTime";
import * as _ from "lodash-es";

// pad the start of `val` with 0's to make the total string length `count` size
function PadStart(val: unknown, count: number) {
  return _.padStart(`${val}`, count, "0");
}

type Props = {
  stamp: Time;
  timestampFormat: TimeDisplayMethod;
  timeZone: string | undefined;
};

function Stamp(props: Props): JSX.Element {
  if (props.timestampFormat === "TOD") {
    const formattedTime = formatTime(props.stamp, props.timeZone);
    return <span>{formattedTime}</span>;
  } else {
    return (
      <span>
        {PadStart(props.stamp.sec, 10)}.{PadStart(props.stamp.nsec, 9)}
      </span>
    );
  }
}

export default Stamp;
