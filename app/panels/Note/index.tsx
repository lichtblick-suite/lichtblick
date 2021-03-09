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

import React, { useCallback } from "react";
import styled from "styled-components";

import helpContent from "./index.help.md";
import Flex from "@foxglove-studio/app/components/Flex";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import { SaveConfig } from "@foxglove-studio/app/types/panels";

const STextArea = styled.textarea`
  width: 100%;
  height: 100%;
  resize: none;
  border: none;
  margin: 0;
  padding: 4px 6px;
  &:focus {
    background: rgba(255, 255, 255, 0.1);
  }
`;

type Config = { noteText: string };
type Props = { config: Config; saveConfig: SaveConfig<Config> };
function Note({ config, saveConfig }: Props) {
  const onChangeText = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      saveConfig({ noteText: (event.target as any).value });
    },
    [saveConfig],
  );

  return (
    <Flex col style={{ height: "100%" }}>
      <PanelToolbar helpContent={helpContent} floating />
      <STextArea placeholder="Enter note here" value={config.noteText} onChange={onChangeText} />
    </Flex>
  );
}
Note.panelType = "Note";
Note.defaultConfig = { noteText: "" };

export default Panel<Config>(Note as any);
