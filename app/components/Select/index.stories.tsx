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
import ReactDOM from "react-dom";
import TestUtils from "react-dom/test-utils";

import { Select, Option } from ".";

storiesOf("components/Select", module)
  .add("closed", () => {
    return (
      <div style={{ padding: 30, width: 300 }}>
        <Select
          text="Hello"
          value="bar"
          onChange={() => {
            // no-op
          }}
        >
          {[]}
        </Select>
      </div>
    );
  })
  .add("empty", () => {
    const ref = React.createRef();
    const onMount = () => {
      // eslint-disable-next-line react/no-find-dom-node
      const node = ReactDOM.findDOMNode(ref.current as any);
      if (!node || node instanceof Text) {
        throw new Error("couldn't find select node");
      }
      TestUtils.Simulate.click(node);
    };
    return (
      <div style={{ padding: 30, width: 300 }} ref={onMount}>
        <Select
          text="Hello"
          value="bar"
          onChange={() => {
            // no-op
          }}
          ref={ref as any}
        >
          {[]}
        </Select>
      </div>
    );
  })
  .add("with items", () => {
    const ref = React.createRef();
    const onMount = () => {
      // eslint-disable-next-line react/no-find-dom-node
      const node = ReactDOM.findDOMNode(ref.current as any);
      if (!node || node instanceof Text) {
        throw new Error("couldn't find select node");
      }
      TestUtils.Simulate.click(node);
    };
    return (
      <div style={{ padding: 30, width: 300 }} ref={onMount}>
        <Select
          text="Hello"
          value="bar"
          onChange={() => {
            // no-op
          }}
          ref={ref as any}
        >
          <Option value="foo">Foo</Option>
          <Option value="bar">Bar</Option>
        </Select>
      </div>
    );
  });
