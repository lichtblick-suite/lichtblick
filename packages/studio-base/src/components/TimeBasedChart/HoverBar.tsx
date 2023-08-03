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

import { RpcScales } from "@foxglove/studio-base/components/Chart/types";
import { useHoverValue } from "@foxglove/studio-base/context/TimelineInteractionStateContext";

import { VerticalBarWrapper } from "./VerticalBarWrapper";

type Props = {
  scales?: RpcScales;
  componentId: string;
  isPlaybackSeconds: boolean;
};

export default React.memo<React.PropsWithChildren<Props>>(function HoverBar({
  children,
  componentId,
  isPlaybackSeconds,
  scales,
}) {
  const hoverValue = useHoverValue({ componentId, isPlaybackSeconds });

  return (
    <VerticalBarWrapper scales={scales} xValue={hoverValue?.value}>
      {children}
    </VerticalBarWrapper>
  );
});
