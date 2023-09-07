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

import Autocomplete from "@foxglove/studio-base/components/Autocomplete";
import Stack from "@foxglove/studio-base/components/Stack";

export default {
  title: "components/Autocomplete",
  component: Autocomplete,
  parameters: { colorScheme: "dark" },
  args: {
    onSelect: () => {},
  },
  decorators: [
    (Story: StoryFn): JSX.Element => (
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

export const WithNonStringItemsAndLeadingWhitespace: Story = {
  args: {
    items: [
      { value: "one", text: "ONE" },
      { value: "two", text: "    TWO" },
      { value: "three", text: "THREE" },
    ],
    getItemText: ({ text }: any) => text,
    filterText: "o",
    value: "o",
  },
  name: "with non-string items and leading whitespace",
  play: clickInput,
};

export const UncontrolledValue: Story = {
  args: {
    items: [{ value: "one" }, { value: "two" }, { value: "three" }],
    getItemText: ({ value }: any) => `item: ${value.toUpperCase()}`,
    filterText: "h",
    value: "h",
  },
  play: clickInput,
};

export const UncontrolledValueLight: Story = {
  ...UncontrolledValue,
  parameters: { colorScheme: "light" },
};

export const UncontrolledValueWithSelectedItem: Story = {
  args: {
    items: [{ value: "one" }, { value: "two" }, { value: "three" }],
    getItemText: ({ value }: any) => `item: ${value.toUpperCase()}`,
    selectedItem: { value: "two" },
  },
  play: clickInput,
};

export const UncontrolledValueWithSelectedItemAndClearOnFocus: Story = {
  args: {
    items: [{ value: "one" }, { value: "two" }, { value: "three" }],
    getItemText: ({ value }: any) => `item: ${value.toUpperCase()}`,
    selectedItem: { value: "two" },
    selectOnFocus: true,
  },
  name: "uncontrolled value with selected item and clearOnFocus",
  play: clickInput,
};

export const SortWhenFilteringFalse: Story = {
  args: {
    items: [{ value: "bab" }, { value: "bb" }, { value: "a2" }, { value: "a1" }],
    getItemText: ({ value }: any) => `item: ${value.toUpperCase()}`,
    sortWhenFiltering: false,
    value: "b",
    filterText: "b",
  },
  name: "sortWhenFiltering=false",
  play: clickInput,
};

export const WithALongTruncatedPathAndAutoSize: Story = {
  render: (args): JSX.Element => (
    <div style={{ width: 200 }}>
      <Autocomplete {...args} />
    </div>
  ),
  args: {
    items: [],
    value: "/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297193}.isSomething",
    autoSize: true,
  },
  name: "with a long truncated path (and autoSize)",
  play: clickInput,
};

export const ManyItems: Story = {
  args: {
    items: _.range(1, 1000).map((i) => `item_${i}`),
    autoSize: true,
  },
  play: clickInput,
};
