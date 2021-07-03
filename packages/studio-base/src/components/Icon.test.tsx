/** @jest-environment jsdom */
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

import CircleIcon from "@mdi/svg/svg/circle.svg";
import { mount } from "enzyme";

import Icon from "./Icon";

describe("<Icon />", () => {
  it("renders simple icon", () => {
    const wrapper = mount(
      <Icon>
        <CircleIcon />
      </Icon>,
    );
    const iconTag = wrapper.find("svg");
    expect(iconTag.length).toBe(1);
  });

  it("stops click event with custom handler", (done) => {
    expect.assertions(0);
    const Container = () => (
      <div onClick={() => done("should not bubble")}>
        <Icon onClick={() => done()}>
          <CircleIcon />
        </Icon>
      </div>
    );
    const wrapper = mount(<Container />);
    wrapper.find(".icon").simulate("click");
  });

  it("does not prevent click by default", (done) => {
    expect.assertions(0);
    const Container = () => (
      <div onClick={() => done()}>
        <Icon>
          <CircleIcon />
        </Icon>
      </div>
    );
    const wrapper = mount(<Container />);
    wrapper.find(".icon").simulate("click");
  });
});
