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
import PencilIcon from "@mdi/svg/svg/pencil.svg";
import { PolygonBuilder, Polygon } from "regl-worldview";

import { useAppConfigurationValue, AppSetting } from "@foxglove/studio-base";
import ExpandingToolbar, { ToolGroup } from "@foxglove/studio-base/components/ExpandingToolbar";
import Icon from "@foxglove/studio-base/components/Icon";
import styles from "@foxglove/studio-base/panels/ThreeDimensionalViz/Layout.module.scss";
import colors from "@foxglove/studio-base/styles/colors.module.scss";

import Polygons from "./Polygons";

export const POLYGON_TAB_TYPE = "Polygons";
export type DrawingTabType = typeof POLYGON_TAB_TYPE;
export type Point2D = { x: number; y: number };
type Props = {
  onSetPolygons: (polygons: Polygon[]) => void;
  polygonBuilder: PolygonBuilder;
  onSetDrawingTabType: (arg0?: DrawingTabType) => void;
  defaultSelectedTab?: DrawingTabType; // for UI testing
  showForTests?: boolean;
};

// add more drawing shapes later, e.g. Grid, Axes, Crosshairs
function DrawingTools({
  defaultSelectedTab,
  onSetDrawingTabType,
  onSetPolygons,
  polygonBuilder,
  showForTests,
}: Props) {
  const [selectedTab, setSelectedTab] = React.useState<DrawingTabType | undefined>(
    defaultSelectedTab,
  );

  const [enableDrawingPolygons = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_DRAWING_POLYGONS,
  );

  return enableDrawingPolygons || showForTests === true ? (
    <ExpandingToolbar
      tooltip="Drawing tools"
      icon={
        <Icon style={{ color: selectedTab != undefined ? colors.accent : "white" }}>
          <PencilIcon />
        </Icon>
      }
      className={styles.buttons}
      selectedTab={selectedTab}
      onSelectTab={(newSelectedTab) => {
        onSetDrawingTabType(newSelectedTab);
        setSelectedTab(newSelectedTab);
      }}
    >
      <ToolGroup name={POLYGON_TAB_TYPE}>
        <Polygons onSetPolygons={onSetPolygons} polygonBuilder={polygonBuilder} />
      </ToolGroup>
    </ExpandingToolbar>
  ) : (
    ReactNull
  );
}

export default React.memo<Props>(DrawingTools);
