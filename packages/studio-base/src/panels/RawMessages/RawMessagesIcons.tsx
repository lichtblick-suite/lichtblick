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
import { mergeStyles } from "@fluentui/react";
import ChartBubbleIcon from "@mdi/svg/svg/chart-bubble.svg";
import ChartLineVariantIcon from "@mdi/svg/svg/chart-line-variant.svg";
import DotsHorizontalIcon from "@mdi/svg/svg/dots-horizontal.svg";
import FilterIcon from "@mdi/svg/svg/filter.svg";
import { ReactElement, useCallback } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import { openSiblingPlotPanel, plotableRosTypes } from "@foxglove/studio-base/panels/Plot";
import {
  openSiblingStateTransitionsPanel,
  transitionableRosTypes,
} from "@foxglove/studio-base/panels/StateTransitions";
import { OpenSiblingPanel } from "@foxglove/studio-base/types/panels";

import { ValueAction } from "./getValueActionForValue";

type Props = {
  valueAction: ValueAction;
  basePath: string;
  onTopicPathChange: (arg0: string) => void;
  openSiblingPanel: OpenSiblingPanel;
};

const iconClassName = mergeStyles({
  "> svg": {
    verticalAlign: "top !important",
  },
});

export default function RawMessagesIcons({
  valueAction,
  basePath,
  onTopicPathChange,
  openSiblingPanel,
}: Props): ReactElement {
  const { singleSlicePath, multiSlicePath, primitiveType, filterPath } = valueAction;

  const openPlotPanel = useCallback(
    (pathSuffix: string) => () => {
      openSiblingPlotPanel(openSiblingPanel, `${basePath}${pathSuffix}`);
    },
    [basePath, openSiblingPanel],
  );
  const openStateTransitionsPanel = useCallback(
    (pathSuffix: string) => () => {
      openSiblingStateTransitionsPanel(openSiblingPanel, `${basePath}${pathSuffix}`);
    },
    [basePath, openSiblingPanel],
  );
  const onFilter = useCallback(
    () => onTopicPathChange(`${basePath}${filterPath}`),
    [basePath, filterPath, onTopicPathChange],
  );

  return (
    <span>
      {filterPath.length > 0 && (
        <Icon
          fade
          className={iconClassName}
          onClick={onFilter}
          tooltip="filter on this value"
          key="filter"
        >
          <FilterIcon />
        </Icon>
      )}
      {plotableRosTypes.includes(primitiveType) && (
        <Icon
          fade
          className={iconClassName}
          onClick={openPlotPanel(singleSlicePath)}
          tooltip="Line chart"
        >
          <ChartLineVariantIcon />
        </Icon>
      )}
      {plotableRosTypes.includes(primitiveType) && multiSlicePath !== singleSlicePath && (
        <Icon
          fade
          className={iconClassName}
          onClick={openPlotPanel(multiSlicePath)}
          tooltip="Scatter plot"
        >
          <ChartBubbleIcon />
        </Icon>
      )}
      {transitionableRosTypes.includes(primitiveType) && multiSlicePath === singleSlicePath && (
        <Icon
          fade
          className={iconClassName}
          onClick={openStateTransitionsPanel(singleSlicePath)}
          tooltip="State Transitions"
        >
          <DotsHorizontalIcon />
        </Icon>
      )}
    </span>
  );
}
