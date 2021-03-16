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
import ChartBubbleIcon from "@mdi/svg/svg/chart-bubble.svg";
import ChartLineVariantIcon from "@mdi/svg/svg/chart-line-variant.svg";
import DotsHorizontalIcon from "@mdi/svg/svg/dots-horizontal.svg";
import TargetIcon from "@mdi/svg/svg/target.svg";
import { ReactElement, useCallback } from "react";

import Icon from "@foxglove-studio/app/components/Icon";
import { openSiblingPlotPanel, plotableRosTypes } from "@foxglove-studio/app/panels/Plot";
import {
  openSiblingStateTransitionsPanel,
  transitionableRosTypes,
} from "@foxglove-studio/app/panels/StateTransitions";
import { PanelConfig } from "@foxglove-studio/app/types/panels";

import { ValueAction } from "./getValueActionForValue";
import styles from "./index.module.scss";

type Props = {
  valueAction: ValueAction;
  basePath: string;
  onTopicPathChange: (arg0: string) => void;
  openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void;
};

export default function RawMessagesIcons({
  valueAction,
  basePath,
  onTopicPathChange,
  openSiblingPanel,
}: Props): ReactElement {
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
  const onPivot = useCallback(
    () =>
      onTopicPathChange(`${basePath}${valueAction.type === "pivot" ? valueAction.pivotPath : ""}`),
    [basePath, onTopicPathChange, valueAction],
  );
  if (valueAction.type === "pivot") {
    return (
      <Icon
        fade
        className={styles.icon}
        onClick={onPivot}
        tooltip="Pivot on this value"
        key="pivot"
      >
        <TargetIcon />
      </Icon>
    );
  }
  const { singleSlicePath, multiSlicePath, primitiveType } = valueAction;
  return (
    <span>
      {plotableRosTypes.includes(primitiveType) && (
        <Icon
          fade
          className={styles.icon}
          onClick={openPlotPanel(singleSlicePath)}
          tooltip="Line chart"
        >
          <ChartLineVariantIcon />
        </Icon>
      )}
      {plotableRosTypes.includes(primitiveType) && multiSlicePath !== singleSlicePath && (
        <Icon
          fade
          className={styles.icon}
          onClick={openPlotPanel(multiSlicePath)}
          tooltip="Scatter plot"
        >
          <ChartBubbleIcon />
        </Icon>
      )}
      {transitionableRosTypes.includes(primitiveType) && multiSlicePath === singleSlicePath && (
        <Icon
          fade
          className={styles.icon}
          onClick={openStateTransitionsPanel(singleSlicePath)}
          tooltip="State Transitions"
        >
          <DotsHorizontalIcon />
        </Icon>
      )}
    </span>
  );
}
