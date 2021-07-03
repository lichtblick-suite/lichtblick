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

import { mount } from "enzyme";

import Button from "./ButtonBase";

describe("<Button />", () => {
  it("fires click callback", (done) => {
    expect.assertions(0);
    const el = mount(<Button onClick={() => done()}>hello</Button>);
    el.simulate("click");
  });

  it("fires onMouseUp callback", (done) => {
    expect.assertions(0);
    const el = mount(<Button onMouseUp={() => done()}>hello</Button>);
    el.simulate("mouseUp");
  });

  it("fires onMouseLeave callback", (done) => {
    expect.assertions(0);
    const el = mount(<Button onMouseLeave={() => done()}>hello</Button>);
    el.simulate("mouseLeave");
  });

  it("fires onFocus callback", (done) => {
    expect.assertions(0);
    const el = mount(<Button onFocus={() => done()}>hello</Button>);
    el.simulate("focus");
  });

  it("accepts custom class name", (done) => {
    const el = mount(
      <Button className="foo" onClick={done}>
        hello
      </Button>,
    );
    expect(el.hasClass("foo")).toBe(true);
    done();
    el.unmount();
  });

  it("accepts custom id", () => {
    const el = mount(<Button id="button-1">hello</Button>);
    expect(el.find("#button-1").exists()).toBe(true);
    el.unmount();
  });

  it("applies bulma-style classes", () => {
    const el = mount(
      <Button small primary warning danger>
        hello
      </Button>,
    );
    const classes = el.getDOMNode().classList;
    expect(classes).toContain("is-small");
    expect(classes).toContain("is-primary");
    expect(classes).toContain("is-warning");
    expect(classes).toContain("is-danger");
    el.unmount();
  });
});
