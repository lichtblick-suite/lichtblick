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

import { isEqual } from "lodash";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
import GlobalVariableName from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/GlobalVariableName";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { getPath } from "../interactionUtils";
import useLinkedGlobalVariables, { LinkedGlobalVariable } from "../useLinkedGlobalVariables";
import SGlobalVariableLink from "./SGlobalVariableLink";
import UnlinkWrapper from "./UnlinkWrapper";

const SPath = styled.span`
  opacity: 0.8;
`;

const SForm = styled.form`
  background-color: ${colors.DARK3};
  margin-left: 8px;
  width: 320px;
  box-shadow: 0 6px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
  flex: 0 0 auto;
  border-radius: 8px;
  overflow: hidden;
`;

const SExistingLinks = styled.div`
  margin-bottom: 8px;
`;

const SList = styled.div`
  margin: 12px 6px;
`;

const SListItem = styled.div`
  display: flex;
  align-items: center;
  margin: 6px;
  width: 100%;
  overflow: hidden;
`;

const STopicWithPath = styled.span`
  margin-left: 12px;
  margin-right: 12px;
  flex: 1 1 0;
  overflow-wrap: break-word;
  overflow: hidden;
`;

type Props = {
  name: string;
  showList?: boolean;
};

export default function UnlinkGlobalVariables({
  name,
  showList = false,
}: Props): JSX.Element | ReactNull {
  const { linkedGlobalVariables, linkedGlobalVariablesByName, setLinkedGlobalVariables } =
    useLinkedGlobalVariables();

  const links: LinkedGlobalVariable[] = linkedGlobalVariablesByName[name] ?? [];
  const firstLink = links[0];

  if (!firstLink) {
    return ReactNull;
  }

  const listStyle = showList ? { marginLeft: 0, marginRight: 0 } : {};

  // the list UI is shared between 3D panel and Global Variables panel
  const listHtml = (
    <SList style={listStyle}>
      {links.map(({ topic, markerKeyPath, name: linkedGlobalVariableName }, idx) => {
        return (
          <SListItem key={idx} style={listStyle}>
            <Button
              danger
              small
              style={{ flexShrink: 0 }}
              onClick={() => {
                const newLinkedGlobalVariables = linkedGlobalVariables.filter(
                  (linkedGlobalVariable) =>
                    !(
                      linkedGlobalVariable.topic === topic &&
                      isEqual(linkedGlobalVariable.markerKeyPath, markerKeyPath) &&
                      linkedGlobalVariable.name === linkedGlobalVariableName
                    ),
                );
                setLinkedGlobalVariables(newLinkedGlobalVariables);
              }}
            >
              Unlink
            </Button>
            <STopicWithPath>
              {topic}.<SPath>{getPath(markerKeyPath)}</SPath>
            </STopicWithPath>
          </SListItem>
        );
      })}
    </SList>
  );
  if (showList) {
    return (
      <SExistingLinks>
        <p style={{ marginTop: 0, lineHeight: "1.4" }}>
          Some links already exist for this variable. The variable’s value will be taken from the
          most recently clicked linked topic.
        </p>
        {listHtml}
      </SExistingLinks>
    );
  }

  return (
    <SGlobalVariableLink>
      <UnlinkWrapper
        tooltip={
          <span>
            Unlink <GlobalVariableName name={name} />
          </span>
        }
        linkedGlobalVariable={firstLink}
      >
        {() => <SForm data-test="unlink-form">{listHtml}</SForm>}
      </UnlinkWrapper>
    </SGlobalVariableLink>
  );
}
