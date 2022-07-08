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

import AddLink from "@mui/icons-material/AddLink";
import { styled as muiStyled, Typography } from "@mui/material";

import GlobalVariableLink from "@foxglove/studio-base/components/GlobalVariableLink";
import { getPath } from "@foxglove/studio-base/components/GlobalVariableLink/utils";

import { LinkedGlobalVariables } from "./useLinkedGlobalVariables";

const StyledTable = muiStyled("table")`
  border: none;
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;

  th,
  td {
    vertical-align: top;
    border: none;
    padding: 4px;
  }
  tr:hover {
    td {
      background-color: ${({ theme }) => theme.palette.action.hover};
      cursor: pointer;
    }
  }
`;

type Props = {
  linkedGlobalVariables: LinkedGlobalVariables;
};

export default function LinkedGlobalVariableList({ linkedGlobalVariables }: Props): JSX.Element {
  if (linkedGlobalVariables.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Click the <AddLink fontSize="small" style={{ verticalAlign: "middle", lineHeight: 1 }} />{" "}
        icon in the “Selected object” tab to link values with global variables.
      </Typography>
    );
  }

  return (
    <>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Clicking on objects from these topics will update the linked global variables.
      </Typography>
      <StyledTable>
        <tbody>
          {linkedGlobalVariables.map((linkedGlobalVariable, index) => (
            <tr key={index}>
              <td>
                <GlobalVariableLink linkedGlobalVariable={linkedGlobalVariable} disablePadding />
              </td>
              <td>
                <Typography component="div" variant="body2" style={{ wordBreak: "break-all" }}>
                  {linkedGlobalVariable.topic}.
                  <Typography component="span" variant="inherit" color="text.secondary">
                    {getPath(linkedGlobalVariable.markerKeyPath)}
                  </Typography>
                </Typography>
              </td>
            </tr>
          ))}
        </tbody>
      </StyledTable>
    </>
  );
}
