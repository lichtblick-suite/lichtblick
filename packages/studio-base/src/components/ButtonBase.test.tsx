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

import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import Button from "./ButtonBase";

describe("<Button />", () => {
  it("fires click callback", (done) => {
    expect.assertions(0);
    const el = mount(
      <ThemeProvider isDark={false}>
        <Button onClick={() => done()}>hello</Button>
      </ThemeProvider>,
    );
    el.simulate("click");
  });

  it("fires onMouseUp callback", (done) => {
    expect.assertions(0);
    const el = mount(
      <ThemeProvider isDark={false}>
        <Button onMouseUp={() => done()}>hello</Button>
      </ThemeProvider>,
    );
    el.simulate("mouseUp");
  });

  it("fires onMouseLeave callback", (done) => {
    expect.assertions(0);
    const el = mount(
      <ThemeProvider isDark={false}>
        <Button onMouseLeave={() => done()}>hello</Button>
      </ThemeProvider>,
    );
    el.simulate("mouseLeave");
  });

  it("fires onFocus callback", (done) => {
    expect.assertions(0);
    const el = mount(
      <ThemeProvider isDark={false}>
        <Button onFocus={() => done()}>hello</Button>
      </ThemeProvider>,
    );
    el.simulate("focus");
  });

  it("accepts custom class name", (done) => {
    const el = mount(
      <ThemeProvider isDark={false}>
        <Button className="foo" onClick={done}>
          hello
        </Button>
      </ThemeProvider>,
    );
    expect(el.getDOMNode().classList).toContain("foo");
    done();
    el.unmount();
  });

  it("accepts custom id", () => {
    const el = mount(
      <ThemeProvider isDark={false}>
        <Button id="button-1">hello</Button>
      </ThemeProvider>,
    );
    expect(el.find("#button-1").exists()).toBe(true);
    el.unmount();
  });

  it("applies bulma-style classes", () => {
    const el = mount(
      <ThemeProvider isDark={false}>
        <Button small primary warning danger>
          hello
        </Button>
      </ThemeProvider>,
    );
    const classes = el.getDOMNode().classList;
    expect(classes).toContain("is-small");
    expect(classes).toContain("is-primary");
    expect(classes).toContain("is-warning");
    expect(classes).toContain("is-danger");
    el.unmount();
  });
});
