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
import React, { SyntheticEvent } from "react";

import Button from "./ButtonBase";

describe("<Button />", () => {
  it("fires click callback", (done) => {
    const el = mount(<Button onClick={() => done()}>hello</Button>);
    el.simulate("click");
  });

  it("fires onMouseUp callback", (done) => {
    const el = mount(<Button onMouseUp={() => done()}>hello</Button>);
    el.simulate("mouseUp");
  });

  it("fires onMouseLeave callback", (done) => {
    const el = mount(<Button onMouseLeave={() => done()}>hello</Button>);
    el.simulate("mouseLeave");
  });

  it("fires onFocus callback", (done) => {
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

  it("delayed button click event does not fire on click", (done: any) => {
    const fail = () => done("Should not have called click callback");
    const el = mount(
      <Button delay={1000} onClick={fail}>
        hello
      </Button>,
    );
    el.simulate("click");
    setImmediate(() => {
      el.unmount();
      done();
    });
  });

  it("delays click callback when mouse is down", (done) => {
    let clicked = false;
    const onClick = (e: SyntheticEvent<HTMLButtonElement>) => {
      clicked = true;
      expect(e).toBeTruthy();
      done();
      el.unmount();
    };
    const el = mount(
      <Button delay={10} onClick={onClick} progressClassName="foo">
        hello
      </Button>,
    );
    el.simulate("mouseDown");
    expect(clicked).toBe(false);
  });

  it("can control mousedown via external calls", (done: any) => {
    const onClick = () => {
      el.unmount();
      done();
    };
    const el = mount<Button>(
      <Button delay={10} onClick={onClick}>
        testing
      </Button>,
    );
    el.instance().onMouseDown({
      persist: () => {
        // do nothing
      },
    } as any);
  });

  it("unmounting cancels done callback", (done: any) => {
    const el = mount<Button>(
      <Button delay={1} onClick={() => done("Should not call done callback")}>
        testing
      </Button>,
    );
    el.instance().onMouseDown({
      persist: () => {
        // do nothing
      },
    } as any);
    setImmediate(() => {
      el.unmount();
      done();
    });
  });
});
