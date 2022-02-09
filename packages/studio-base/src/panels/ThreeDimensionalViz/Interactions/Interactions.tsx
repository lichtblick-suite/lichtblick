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

import { Checkbox } from "@fluentui/react";

import { MouseEventObject } from "@foxglove/regl-worldview";
import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove/studio-base/components/ExpandingToolbar";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import ObjectDetails from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/ObjectDetails";
import TopicLink from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/TopicLink";
import { SelectedObject } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { decodeAdditionalFields } from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/selection";
import { getInteractionData } from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { ThreeDimensionalVizConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { PointCloud2 } from "@foxglove/studio-base/types/Messages";
import { SaveConfig, PanelConfig } from "@foxglove/studio-base/types/panels";
import { maybeCast } from "@foxglove/studio-base/util/maybeCast";

import LinkedGlobalVariableList from "./LinkedGlobalVariableList";
import PointCloudDetails from "./PointCloudDetails";
import { SEmptyState, SRow, SValue } from "./styling";
import useLinkedGlobalVariables from "./useLinkedGlobalVariables";

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
  const { object } = selectedObject ?? {};
  const selectedInteractionData = getInteractionData(selectedObject);

  const { originalMessage } = selectedInteractionData ?? {};

  const isPointCloud = maybeCast<{ type?: number }>(object)?.type === 102;
  const maybeFullyDecodedObject = React.useMemo(
    () =>
      isPointCloud
        ? decodeAdditionalFields(originalMessage as unknown as PointCloud2)
        : originalMessage,
    [isPointCloud, originalMessage],
  );

  const { linkedGlobalVariables } = useLinkedGlobalVariables();

  return (
    <ExpandingToolbar
      tooltip="Inspect objects"
      iconName="CursorDefault"
      selectedTab={interactionsTabType}
      onSelectTab={(newSelectedTab) => setInteractionsTabType(newSelectedTab)}
    >
      <ToolGroup name={OBJECT_TAB_TYPE}>
        <ToolGroupFixedSizePane>
          {maybeFullyDecodedObject ? (
            <>
              {selectedInteractionData && (
                <SRow>
                  <SValue>
                    <TopicLink topic={selectedInteractionData.topic} />
                  </SValue>
                </SRow>
              )}
              {isPointCloud && (
                <PointCloudDetails selectedObject={selectedObject as SelectedObject} />
              )}
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
            styles={{
              checkmark: { fontSize: 9, lineHeight: 14, ".is-checked &": { color: "#fff" } },
              checkbox: { height: 14, width: 14, marginTop: 2 },
              text: { fontSize: 12 },
            }}
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
export default function Interactions(props: Props): JSX.Element {
  const { saveConfig, config: { disableAutoOpenClickedObject = false } = {} } = (React.useContext(
    PanelContext,
  ) ?? { saveConfig: () => {} }) as { config?: ThreeDimensionalVizConfig; saveConfig: () => void };
  return (
    <InteractionsBaseComponent
      {...props}
      saveConfig={saveConfig}
      disableAutoOpenClickedObject={disableAutoOpenClickedObject}
    />
  );
}
