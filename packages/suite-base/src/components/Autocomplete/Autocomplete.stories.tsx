// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { Meta, StoryFn, StoryObj } from "@storybook/react";
import { fireEvent, within } from "@storybook/testing-library";
import * as _ from "lodash-es";

import Stack from "@lichtblick/suite-base/components/Stack";

import { Autocomplete } from "./Autocomplete";

export default {
  title: "components/Autocomplete",
  component: Autocomplete,
  parameters: { colorScheme: "dark" },
  args: {
    onSelect: () => {},
  },
  decorators: [
    (Story: StoryFn): React.JSX.Element => (
      <Stack padding={2.5}>
        <Story />
      </Stack>
    ),
  ],
} satisfies Meta<typeof Autocomplete>;

type Story = StoryObj<typeof Autocomplete>;

const clickInput: Story["play"] = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const input = await canvas.findByTestId("autocomplete-textfield");

  fireEvent.click(input);
};

export const FilteringToO: Story = {
  args: {
    items: ["one", "two", "three"],
    hasError: true,
    filterText: "o",
    value: "o",
  },
  name: "filtering to 'o'",
  play: clickInput,
};

export const FilteringToOLight: Story = {
  ...FilteringToO,
  name: "filtering to 'o' light",
  parameters: { colorScheme: "light" },
};

export const UncontrolledValue: Story = {
  args: {
    items: ["one", "two", "three"],
    filterText: "h",
    value: "h",
  },
  play: clickInput,
};

export const UncontrolledValueLight: Story = {
  ...UncontrolledValue,
  parameters: { colorScheme: "light" },
};

export const SortWhenFilteringFalse: Story = {
  args: {
    items: ["bab", "bb", "a2", "a1"],
    sortWhenFiltering: false,
    value: "b",
    filterText: "b",
  },
  name: "sortWhenFiltering=false",
  play: clickInput,
};

export const ManyItems: Story = {
  args: {
    items: _.range(1, 1000).map((i) => `item_${i}`),
  },
  play: clickInput,
};

export const LongPathInPopup: Story = {
  render: (args): React.JSX.Element => (
    <div style={{ width: 200 }}>
      <Autocomplete {...args} />
    </div>
  ),
  args: {
    items: [
      "/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297193}.isSomething",
      "/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297194}.isSomething",
      "/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297195}.isSomething",
    ],
    value: "/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297193}.isSomething",
    filterText: "/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{",
  },
  play: clickInput,
};
