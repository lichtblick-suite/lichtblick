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

import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import { ReactElement } from "react";

import Item from "@foxglove-studio/app/components/Menu/Item";

import Config from "./Config";

type Props = {
  config: Config;
  saveConfig: (config: Partial<Config>) => void;
};

export default function NodePlaygroundSettings({ config, saveConfig }: Props): ReactElement {
  const autoFormatOnSave = config.autoFormatOnSave === true;
  return (
    <>
      <Item
        icon={autoFormatOnSave ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
        onClick={() => saveConfig({ autoFormatOnSave: !autoFormatOnSave })}
      >
        <span>Auto-format on save</span>
      </Item>
    </>
  );
}
