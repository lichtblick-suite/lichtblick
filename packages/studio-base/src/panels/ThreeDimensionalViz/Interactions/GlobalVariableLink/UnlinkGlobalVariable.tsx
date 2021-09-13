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

import { getPath } from "../interactionUtils";
import useLinkedGlobalVariables, { LinkedGlobalVariable } from "../useLinkedGlobalVariables";
import SGlobalVariableForm from "./SGlobalVariableForm";

const SPath = styled.span`
  opacity: 0.8;
`;

type Props = {
  linkedGlobalVariable: LinkedGlobalVariable;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setIsOpen: (arg0: boolean) => void;
};

export default function UnlinkGlobalVariable({
  linkedGlobalVariable: { topic, markerKeyPath, name },
  setIsOpen,
}: Props): JSX.Element {
  const { linkedGlobalVariables, setLinkedGlobalVariables } = useLinkedGlobalVariables();
  return (
    <SGlobalVariableForm style={{ marginLeft: 8 }} data-test="unlink-form">
      <p style={{ marginTop: 0, lineHeight: "1.4" }}>
        Unlink <GlobalVariableName name={name} /> from {topic}.
        <SPath>{getPath(markerKeyPath)}</SPath>?
      </p>
      <Button
        danger
        onClick={() => {
          const newLinkedGlobalVariables = linkedGlobalVariables.filter(
            (linkedGlobalVariable) =>
              !(
                linkedGlobalVariable.topic === topic &&
                isEqual(linkedGlobalVariable.markerKeyPath, markerKeyPath) &&
                linkedGlobalVariable.name === name
              ),
          );
          setLinkedGlobalVariables(newLinkedGlobalVariables);
          setIsOpen(false);
        }}
      >
        Unlink
      </Button>
      <Button onClick={() => setIsOpen(false)}>Cancel</Button>
    </SGlobalVariableForm>
  );
}
