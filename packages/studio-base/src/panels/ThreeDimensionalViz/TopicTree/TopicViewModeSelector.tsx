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

import styled from "styled-components";

import Dropdown from "@foxglove/studio-base/components/Dropdown";

import { Save3DConfig } from "..";

export const TOPIC_DISPLAY_MODES = {
  SHOW_ALL: {
    value: "SHOW_ALL",
    label: "All",
  },
  SHOW_AVAILABLE: {
    value: "SHOW_AVAILABLE",
    label: "Available",
  },
  SHOW_SELECTED: {
    value: "SHOW_SELECTED",
    label: "Visible",
  },
} as const;

const DEFAULT_DISPLAY_MODE = TOPIC_DISPLAY_MODES.SHOW_ALL.value;
const DEFAULT_BTN_WIDTH = 88; // Width for the longest selected option in dropdown.
const XS_WIDTH_BTN_WIDTH = 48;

const dropdownOptions = (Object.keys(TOPIC_DISPLAY_MODES) as TopicDisplayMode[]).map((key) => ({
  label: TOPIC_DISPLAY_MODES[key].label,
  value: TOPIC_DISPLAY_MODES[key].value,
}));

export type TopicDisplayMode = keyof typeof TOPIC_DISPLAY_MODES;

const STopicViewModeSelector = styled.div`
  margin-right: 4px;
  div {
    button {
      justify-content: space-between;
      line-height: 1.4;
    }
  }
`;
type Props = {
  isXSWidth: boolean;
  topicDisplayMode: TopicDisplayMode;
  saveConfig: Save3DConfig;
};

export default function TopicViewModeSelector({
  isXSWidth,
  topicDisplayMode: topicDisplayModeProp,
  saveConfig,
}: Props): JSX.Element {
  const topicDisplayMode =
    TOPIC_DISPLAY_MODES[topicDisplayModeProp] != undefined
      ? topicDisplayModeProp
      : DEFAULT_DISPLAY_MODE;
  return (
    <STopicViewModeSelector>
      <Dropdown
        btnStyle={{ width: isXSWidth ? XS_WIDTH_BTN_WIDTH : DEFAULT_BTN_WIDTH }}
        position="below"
        value={topicDisplayMode}
        text={TOPIC_DISPLAY_MODES[topicDisplayMode].label}
        onChange={(newValue) => saveConfig({ topicDisplayMode: newValue })}
      >
        {dropdownOptions.map(({ label, value }) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </Dropdown>
    </STopicViewModeSelector>
  );
}
