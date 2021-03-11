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

import React, { ReactElement, useMemo } from "react";
import { Time } from "rosbag";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import { MessageDataItemsByPath } from "@foxglove-studio/app/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import useMessagesByPath from "@foxglove-studio/app/components/MessagePathSyntax/useMessagesByPath";

type MessageHistoryData = {
  itemsByPath: MessageDataItemsByPath;
  startTime: Time;
};

type Props = {
  children: (arg0: MessageHistoryData) => ReactElement;
  paths: string[];
  historySize?: number;
};

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });

// DEPRECATED in favor of PanelAPI.useMessagesByTopic and useCachedGetMessagePathDataItems.
//
// Be sure to pass in a new render function when you want to force a rerender.
// So you probably don't want to do `<MessageHistoryDEPRECATED>{this._renderSomething}</MessageHistoryDEPRECATED>`.
// This might be a bit counterintuitive but we do this since performance matters here.
export default React.memo<Props>(function MessageHistoryDEPRECATED({
  // eslint-disable-next-line react/prop-types
  children,
  // eslint-disable-next-line react/prop-types
  paths,
  // eslint-disable-next-line react/prop-types
  historySize,
}: Props) {
  const { startTime } = PanelAPI.useDataSourceInfo();
  const itemsByPath = useMessagesByPath(paths, historySize);
  return useMemo(() => children({ itemsByPath, startTime: startTime ?? ZERO_TIME }), [
    children,
    itemsByPath,
    startTime,
  ]);
});
