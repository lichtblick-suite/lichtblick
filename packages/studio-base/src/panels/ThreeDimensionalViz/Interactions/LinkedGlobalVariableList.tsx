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

import LinkPlusIcon from "@mdi/svg/svg/link-plus.svg";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyTable } from "@foxglove/studio-base/components/LegacyStyledComponents";

import GlobalVariableLink from "./GlobalVariableLink/index";
import GlobalVariableName from "./GlobalVariableName";
import { getPath } from "./interactionUtils";
import { SEmptyState } from "./styling";
import { LinkedGlobalVariables } from "./useLinkedGlobalVariables";

const SPath = styled.span`
  opacity: 0.8;
`;

const STable = styled(LegacyTable)`
  td {
    padding: 0.3em;
    border: none;
    vertical-align: middle;
  }
`;

type Props = {
  linkedGlobalVariables: LinkedGlobalVariables;
};

export default function LinkedGlobalVariableList({ linkedGlobalVariables }: Props): JSX.Element {
  if (linkedGlobalVariables.length === 0) {
    return (
      <SEmptyState>
        Click the{" "}
        <Icon
          style={{ display: "inline", verticalAlign: "middle", lineHeight: 1 }}
          clickable={false}
        >
          <LinkPlusIcon />
        </Icon>{" "}
        icon in the “Selected object” tab to link values with global variables.
      </SEmptyState>
    );
  }
  return (
    <>
      <SEmptyState>
        Clicking on objects from these topics will update the linked global variables.
      </SEmptyState>
      <STable>
        <tbody>
          {linkedGlobalVariables.map((linkedGlobalVariable, index) => (
            <tr key={index}>
              <td>
                <GlobalVariableLink
                  linkedGlobalVariable={linkedGlobalVariable}
                  unlinkTooltip={
                    <span>
                      Unlink <GlobalVariableName name={linkedGlobalVariable.name} />
                    </span>
                  }
                />
              </td>
              <td style={{ wordBreak: "break-all" }}>
                {linkedGlobalVariable.topic}.
                <SPath>{getPath(linkedGlobalVariable.markerKeyPath)}</SPath>
              </td>
            </tr>
          ))}
        </tbody>
      </STable>
    </>
  );
}
