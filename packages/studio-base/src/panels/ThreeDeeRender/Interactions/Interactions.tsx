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

import CursorIcon from "@mdi/svg/svg/cursor-default.svg";
import { Typography } from "@mui/material";

import type { LayoutActions } from "@foxglove/studio";
import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove/studio-base/components/ExpandingToolbar";

import { Pose } from "../transforms";
import ObjectDetails from "./ObjectDetails";
import TopicLink from "./TopicLink";
import { InteractionData } from "./types";

// ts-prune-ignore-next
export const OBJECT_TAB_TYPE = "Selected object";
// ts-prune-ignore-next
export const LINKED_VARIABLES_TAB_TYPE = "Linked variables";
export type TabType = typeof OBJECT_TAB_TYPE | typeof LINKED_VARIABLES_TAB_TYPE;

export type SelectionObject = {
  object: {
    pose: Pose;
    interactionData?: InteractionData;
  };
  instanceIndex: number | undefined;
};

type Props = {
  interactionsTabType?: TabType;
  setInteractionsTabType: (arg0?: TabType) => void;
  addPanel: LayoutActions["addPanel"];
  selectedObject?: SelectionObject;
};

const InteractionsBaseComponent = React.memo<Props>(function InteractionsBaseComponent({
  addPanel,
  selectedObject,
  interactionsTabType,
  setInteractionsTabType,
}: Props) {
  const selectedInteractionData = selectedObject?.object.interactionData;
  const originalMessage = selectedInteractionData?.originalMessage;
  const instanceDetails = selectedInteractionData?.instanceDetails;

  return (
    <ExpandingToolbar
      tooltip="Inspect objects"
      icon={<CursorIcon />}
      selectedTab={interactionsTabType}
      onSelectTab={(newSelectedTab) => setInteractionsTabType(newSelectedTab)}
    >
      <ToolGroup name={OBJECT_TAB_TYPE}>
        <ToolGroupFixedSizePane>
          {originalMessage ? (
            <>
              {selectedInteractionData.topic && (
                <TopicLink addPanel={addPanel} topic={selectedInteractionData.topic} />
              )}
              {instanceDetails ? <ObjectDetails selectedObject={instanceDetails} /> : <></>}
              <ObjectDetails
                selectedObject={originalMessage}
                interactionData={selectedInteractionData}
              />
            </>
          ) : (
            <Typography variant="body2" color="text.disabled" gutterBottom>
              Click an object in the 3D view to select it.
            </Typography>
          )}
        </ToolGroupFixedSizePane>
      </ToolGroup>
    </ExpandingToolbar>
  );
});

// Wrap the Interactions so that we don't rerender every time any part of the PanelContext config changes, but just the
// one value that we care about.
export default function Interactions(props: Props): JSX.Element {
  return <InteractionsBaseComponent {...props} />;
}
