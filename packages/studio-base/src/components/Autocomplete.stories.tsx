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

import { storiesOf } from "@storybook/react";
import { Component } from "react";
import TestUtils from "react-dom/test-utils";

import Autocomplete from "@foxglove/studio-base/components/Autocomplete";

function focusInput(el: any) {
  if (el) {
    const input = el.querySelector("input");
    if (input) {
      input.focus();
    }
  }
}

storiesOf("components/Autocomplete", module)
  .add("filtering to 'o'", () => {
    class Example extends Component {
      override render() {
        return (
          <div style={{ padding: 20 }} ref={focusInput}>
            <Autocomplete
              items={["one", "two", "three"]}
              filterText={"o"}
              value={"o"}
              onSelect={() => {
                // no-op
              }}
              hasError
            />
          </div>
        );
      }
    }
    return <Example />;
  })
  .add("with non-string items and leading whitespace", () => {
    return (
      <div style={{ padding: 20 }} ref={focusInput}>
        <Autocomplete
          items={[
            { value: "one", text: "ONE" },
            { value: "two", text: "    TWO" },
            { value: "three", text: "THREE" },
          ]}
          getItemText={({ text }: any) => text}
          filterText={"o"}
          value={"o"}
          onSelect={() => {
            // no-op
          }}
        />
      </div>
    );
  })
  .add("uncontrolled value", () => {
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
          onSelect={() => {
            // no-op
          }}
        />
      </div>
    );
  })
  .add("uncontrolled value with selected item", () => {
    return (
      <div style={{ padding: 20 }} ref={focusInput}>
        <Autocomplete
          items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
          getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
          selectedItem={{ value: "two" }}
          onSelect={() => {
            // no-op
          }}
        />
      </div>
    );
  })
  .add("uncontrolled value with selected item and clearOnFocus", () => {
    return (
      <div style={{ padding: 20 }} ref={focusInput}>
        <Autocomplete
          items={[{ value: "one" }, { value: "two" }, { value: "three" }]}
          getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
          selectedItem={{ value: "two" }}
          onSelect={() => {
            // no-op
          }}
          clearOnFocus
        />
      </div>
    );
  })
  .add("sortWhenFiltering=false", () => {
    return (
      <div style={{ padding: 20 }} ref={focusInput}>
        <Autocomplete
          items={[{ value: "bab" }, { value: "bb" }, { value: "a2" }, { value: "a1" }]}
          getItemText={({ value }: any) => `item: ${value.toUpperCase()}`}
          value={"b"}
          onSelect={() => {
            // no-op
          }}
          sortWhenFiltering={false}
        />
      </div>
    );
  })
  .add("at the right edge of the screen", () => {
    class Example extends Component {
      override render() {
        return (
          <div style={{ position: "absolute", right: 0, padding: 20 }} ref={focusInput}>
            <Autocomplete
              items={["loooooooooooooong item"]}
              value="looo"
              onSelect={() => {
                // no-op
              }}
            />
          </div>
        );
      }
    }
    return <Example />;
  })
  .add("with a long truncated path (and autoSize)", () => {
    class Example extends Component {
      override render() {
        return (
          <div style={{ maxWidth: 200 }} ref={focusInput}>
            <Autocomplete
              items={[]}
              value="/abcdefghi_jklmnop.abcdefghi_jklmnop[:]{some_id==1297193}.isSomething"
              onSelect={() => {
                // no-op
              }}
              autoSize
            />
          </div>
        );
      }
    }
    return <Example />;
  });
