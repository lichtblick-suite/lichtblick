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

import { StoryFn } from "@storybook/react";
import { range } from "lodash";
import { Component } from "react";
import TestUtils from "react-dom/test-utils";

import Autocomplete from "@foxglove/studio-base/components/Autocomplete";

function focusInput(el: HTMLDivElement | ReactNull) {
  if (el) {
    const input = el.querySelector("input");
    if (input) {
      input.focus();
    }
  }
}

export default {
  title: "components/Autocomplete",

  parameters: {
    colorScheme: "dark",
  },
};

export const FilteringToO: StoryFn = () => {
  class Example extends Component {
    public override render() {
      return (
        <div style={{ padding: 20 }} ref={focusInput}>
          <Autocomplete
            items={["one", "two", "three"]}
            filterText="o"
            value="o"
            onSelect={() => {}}
            hasError
          />
        </div>
      );
    }
  }
  return <Example />;
};

FilteringToO.storyName = "filtering to 'o'";

export const FilteringToOLight: StoryFn = () => {
  class Example extends Component {
    public override render() {
      return (
        <div style={{ padding: 20 }} ref={focusInput}>
          <Autocomplete
            items={["one", "two", "three"]}
            filterText="o"
            value="o"
            onSelect={() => {}}
            hasError
          />
        </div>
      );
    }
  }
  return <Example />;
};

FilteringToOLight.storyName = "filtering to 'o' light";
FilteringToOLight.parameters = { colorScheme: "light" };

export const WithNonStringItemsAndLeadingWhitespace: StoryFn = () => {
  return (
    <div style={{ padding: 20 }} ref={focusInput}>
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
    </div>
  );
};

WithNonStringItemsAndLeadingWhitespace.storyName = "with non-string items and leading whitespace";

export const UncontrolledValue: StoryFn = () => {
  return (
    <div
      style={{ padding: 20 }}
      ref={(el) => {
        if (el) {
          const input: HTMLInputElement | undefined = el.querySelector("input") as any;
          if (input) {
            input.focus();
            input.value = "h";
            TestUtils.Simulate.change(input);
          }
        }
      }}
    >
      <Autocomplete
        items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
        getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
        onSelect={() => {}}
      />
    </div>
  );
};

UncontrolledValue.storyName = "uncontrolled value";

export const UncontrolledValueLight: StoryFn = () => {
  return (
    <div
      style={{ padding: 20 }}
      ref={(el) => {
        if (el) {
          const input: HTMLInputElement | undefined = el.querySelector("input") as any;
          if (input) {
            input.focus();
            input.value = "h";
            TestUtils.Simulate.change(input);
          }
        }
      }}
    >
      <Autocomplete
        items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
        getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
        onSelect={() => {}}
      />
    </div>
  );
};

UncontrolledValueLight.storyName = "uncontrolled value light";
UncontrolledValueLight.parameters = { colorScheme: "light" };

export const UncontrolledValueWithSelectedItem: StoryFn = () => {
  return (
    <div style={{ padding: 20 }} ref={focusInput}>
      <Autocomplete
        items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
        getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
        selectedItem={{ value: "two" }}
        onSelect={() => {}}
      />
    </div>
  );
};

UncontrolledValueWithSelectedItem.storyName = "uncontrolled value with selected item";

export const UncontrolledValueWithSelectedItemAndClearOnFocus: StoryFn = () => {
  return (
    <div style={{ padding: 20 }} ref={focusInput}>
      <Autocomplete
        items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
        getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
        selectedItem={{ value: "two" }}
        onSelect={() => {}}
        selectOnFocus
      />
    </div>
  );
};

UncontrolledValueWithSelectedItemAndClearOnFocus.storyName =
  "uncontrolled value with selected item and clearOnFocus";

export const SortWhenFilteringFalse: StoryFn = () => {
  return (
    <div style={{ padding: 20 }} ref={focusInput}>
      <Autocomplete
        items={[{ value: "bab" }, { value: "bb" }, { value: "a2" }, { value: "a1" }]}
        getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
        value="b"
        onSelect={() => {}}
        sortWhenFiltering={false}
      />
    </div>
  );
};

SortWhenFilteringFalse.storyName = "sortWhenFiltering=false";

export const WithALongTruncatedPathAndAutoSize: StoryFn = () => {
  class Example extends Component {
    public override render() {
      return (
        <div style={{ maxWidth: 200 }} ref={focusInput}>
          <Autocomplete
            items={[]}
            value="/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297193}.isSomething"
            onSelect={() => {}}
            autoSize
          />
        </div>
      );
    }
  }
  return <Example />;
};

WithALongTruncatedPathAndAutoSize.storyName = "with a long truncated path (and autoSize)";

export const ManyItems: StoryFn = () => {
  const items = range(1, 1000).map((i) => `item_${i}`);
  class Example extends Component {
    public override render() {
      return (
        <div style={{ maxWidth: 200 }} ref={focusInput}>
          <Autocomplete items={items} onSelect={() => {}} autoSize />
        </div>
      );
    }
  }
  return <Example />;
};

ManyItems.storyName = "many items";
