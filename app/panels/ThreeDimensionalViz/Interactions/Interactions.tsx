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

import CursorDefault from "@mdi/svg/svg/cursor-default.svg";
import * as React from "react";
import { MouseEventObject } from "regl-worldview";

import LinkedGlobalVariableList from "./LinkedGlobalVariableList";
import PointCloudDetails from "./PointCloudDetails";
import { SEmptyState, SRow, SValue } from "./styling";
import useLinkedGlobalVariables from "./useLinkedGlobalVariables";
import Checkbox from "@foxglove-studio/app/components/Checkbox";
import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove-studio/app/components/ExpandingToolbar";
import Icon from "@foxglove-studio/app/components/Icon";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import ObjectDetails from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/ObjectDetails";
import TopicLink from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/TopicLink";
import styles from "@foxglove-studio/app/panels/ThreeDimensionalViz/Layout.module.scss";
import { decodeAdditionalFields } from "@foxglove-studio/app/panels/ThreeDimensionalViz/commands/PointClouds/selection";
import { getInteractionData } from "@foxglove-studio/app/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { SaveConfig, PanelConfig } from "@foxglove-studio/app/types/panels";

export const OBJECT_TAB_TYPE = "Selected object";
export const LINKED_VARIABLES_TAB_TYPE = "Linked variables";
export type TabType = typeof OBJECT_TAB_TYPE | typeof LINKED_VARIABLES_TAB_TYPE;

type Props = {
  interactionsTabType?: TabType;
  setInteractionsTabType: (arg0?: TabType) => void;
  selectedObject?: MouseEventObject;
};

type PropsWithConfig = Props & {
  disableAutoOpenClickedObject: boolean;
  saveConfig: SaveConfig<PanelConfig>;
};

const InteractionsBaseComponent = React.memo<PropsWithConfig>(function InteractionsBaseComponent({
  selectedObject,
  interactionsTabType,
  setInteractionsTabType,
  disableAutoOpenClickedObject,
  saveConfig,
}: PropsWithConfig) {
  const { object } = selectedObject || {};
  const isPointCloud = object && object.type === 102;
  const maybeFullyDecodedObject = React.useMemo(
    () =>
      isPointCloud ? { ...selectedObject, object: decodeAdditionalFields(object) } : selectedObject,
    [isPointCloud, object, selectedObject],
  );

  const { linkedGlobalVariables } = useLinkedGlobalVariables();
  const selectedInteractionData = selectedObject && getInteractionData(selectedObject);

  return (
    <ExpandingToolbar
      tooltip="Inspect Objects"
      icon={
        <Icon style={{ color: "white" }}>
          <CursorDefault />
        </Icon>
      }
      className={styles.buttons}
      selectedTab={interactionsTabType}
      onSelectTab={(newSelectedTab) => setInteractionsTabType(newSelectedTab)}
    >
      <ToolGroup name={OBJECT_TAB_TYPE}>
        <ToolGroupFixedSizePane>
          {selectedObject ? (
            <>
              {selectedInteractionData && (
                <SRow>
                  <SValue>
                    <TopicLink topic={selectedInteractionData.topic} />
                  </SValue>
                </SRow>
              )}
              {isPointCloud && <PointCloudDetails selectedObject={maybeFullyDecodedObject} />}
              <ObjectDetails
                selectedObject={maybeFullyDecodedObject}
                interactionData={selectedInteractionData}
              />
            </>
          ) : (
            <SEmptyState>Click an object in the 3D view to select it.</SEmptyState>
          )}
          <Checkbox
            label="Open this panel automatically"
            checked={!disableAutoOpenClickedObject}
            onChange={() =>
              saveConfig({ disableAutoOpenClickedObject: !disableAutoOpenClickedObject })
            }
          />
        </ToolGroupFixedSizePane>
      </ToolGroup>
      <ToolGroup name={LINKED_VARIABLES_TAB_TYPE}>
        <ToolGroupFixedSizePane>
          <LinkedGlobalVariableList linkedGlobalVariables={linkedGlobalVariables} />
        </ToolGroupFixedSizePane>
      </ToolGroup>
    </ExpandingToolbar>
  );
});

// Wrap the Interactions so that we don't rerender every time any part of the PanelContext config changes, but just the
// one value that we care about.
export default function Interactions(props: Props) {
  const { saveConfig, config: { disableAutoOpenClickedObject } = {} as any } =
    React.useContext(PanelContext) || {};
  return (
    <InteractionsBaseComponent
      {...props}
      saveConfig={saveConfig as any}
      disableAutoOpenClickedObject={disableAutoOpenClickedObject}
    />
  );
}
