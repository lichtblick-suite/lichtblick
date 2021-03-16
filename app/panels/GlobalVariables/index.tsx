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

import { ReactElement } from "react";
import styled from "styled-components";

import GlobalVariablesTable from "@foxglove-studio/app/components/GlobalVariablesTable";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";

import helpContent from "./index.help.md";

const SGlobalVariablesPanel = styled.div`
  display: flex;
  flex-direction: column;
`;

function GlobalVariables(): ReactElement {
  return (
    <SGlobalVariablesPanel>
      <PanelToolbar helpContent={helpContent} floating />
      <GlobalVariablesTable />
    </SGlobalVariablesPanel>
  );
}

GlobalVariables.panelType = "Global";
GlobalVariables.defaultConfig = {};

export default Panel(GlobalVariables);
