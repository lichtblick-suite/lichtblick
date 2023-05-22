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

import { StoryFn, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/testing-library";
import { range } from "lodash";

import Autocomplete from "@foxglove/studio-base/components/Autocomplete";
import Stack from "@foxglove/studio-base/components/Stack";

export default {
  title: "components/Autocomplete",
  parameters: { colorScheme: "dark" },
  decorators: [
    (Story: StoryFn): JSX.Element => (
      <Stack padding={2.5}>
        <Story />
      </Stack>
    ),
  ],
};

const clickInput: StoryObj["play"] = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const input = await canvas.findByTestId("autocomplete-textfield");

  userEvent.click(input);
};

export const FilteringToO: StoryObj = {
  render: () => (
    <Autocomplete
      items={["one", "two", "three"]}
      filterText="o"
      value="o"
      onSelect={() => {}}
      hasError
    />
  ),
  name: "filtering to 'o'",
  play: clickInput,
};

export const FilteringToOLight: StoryObj = {
  ...FilteringToO,
  name: "filtering to 'o' light",
  parameters: { colorScheme: "light" },
};

export const WithNonStringItemsAndLeadingWhitespace: StoryObj = {
  render: () => (
    <Autocomplete
      items={[
        { value: "one", text: "ONE" },
        { value: "two", text: "    TWO" },
        { value: "three", text: "THREE" },
      ]}
      getItemText={({ text }: any) => text}
      filterText="o"
      value="o"
      onSelect={() => {}}
    />
  ),
  name: "with non-string items and leading whitespace",
  play: clickInput,
};

export const UncontrolledValue: StoryObj = {
  render: () => (
    <Autocomplete
      items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
      getItemText={({ value }) => `item: ${value.toUpperCase()}`}
      onSelect={() => {}}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByTestId("autocomplete-textfield");
    userEvent.type(input, "h");
  },
};

export const UncontrolledValueLight: StoryObj = {
  ...UncontrolledValue,
  parameters: { colorScheme: "light" },
};

export const UncontrolledValueWithSelectedItem: StoryObj = {
  render: () => (
    <Autocomplete
      items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
      getItemText={({ value }) => `item: ${value.toUpperCase()}`}
      selectedItem={{ value: "two" }}
      onSelect={() => {}}
    />
  ),
  play: clickInput,
};

export const UncontrolledValueWithSelectedItemAndClearOnFocus: StoryObj = {
  render: () => (
    <Autocomplete
      items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
      getItemText={({ value }) => `item: ${value.toUpperCase()}`}
      selectedItem={{ value: "two" }}
      onSelect={() => {}}
      selectOnFocus
    />
  ),
  name: "uncontrolled value with selected item and clearOnFocus",
  play: clickInput,
};

export const SortWhenFilteringFalse: StoryObj = {
  render: () => (
    <Autocomplete
      items={[{ value: "bab" }, { value: "bb" }, { value: "a2" }, { value: "a1" }]}
      getItemText={({ value }) => `item: ${value.toUpperCase()}`}
      value="b"
      onSelect={() => {}}
      sortWhenFiltering={false}
    />
  ),
  name: "sortWhenFiltering=false",
  play: clickInput,
};

export const WithALongTruncatedPathAndAutoSize: StoryObj = {
  render: () => (
    <div style={{ width: 200 }}>
      <Autocomplete
        items={[]}
        value="/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297193}.isSomething"
        onSelect={() => {}}
        autoSize
      />
    </div>
  ),
  name: "with a long truncated path (and autoSize)",
  play: clickInput,
};

export const ManyItems: StoryObj = {
  render: () => (
    <Autocomplete items={range(1, 1000).map((i) => `item_${i}`)} onSelect={() => {}} autoSize />
  ),
  play: clickInput,
};
