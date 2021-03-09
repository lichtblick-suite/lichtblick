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
import { DependencyList } from "react";
import { act } from "react-dom/test-utils";

import useEventListener from "./useEventListener";

interface EventSource {
  addEventListener: Element["addEventListener"];
  removeEventListener: Element["removeEventListener"];
}

describe("useEventListener", () => {
  type TestParams = {
    target: EventSource;
    type: string;
    enable: boolean;
    handler: () => void;
    dependencies?: DependencyList;
  };
  const Test = ({ target, type, enable, handler, dependencies = [] }: TestParams) => {
    useEventListener(target, type, enable, handler, dependencies);
    return null;
  };

  const handler = jest.fn();
  type TestElement = {
    addEventListener: jest.Mock<void, Parameters<Element["addEventListener"]>>;
    removeEventListener: jest.Mock;
  };
  const target: TestElement = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  beforeEach(() => {
    target.addEventListener = jest.fn();
    target.removeEventListener = jest.fn();
  });

  it("follows a sequence for registering and unregistering handlers during react life cycle", () => {
    const el = mount(<Test type="keyup" enable handler={handler} target={target} />);
    expect(target.addEventListener.mock.calls).toEqual([["keyup", handler]]);
    el.setProps({ type: "keydown" });
    expect(target.removeEventListener.mock.calls).toEqual([["keyup", handler]]);
    expect(target.addEventListener.mock.calls).toEqual([
      ["keyup", handler],
      ["keydown", handler],
    ]);
    act(() => {
      el.unmount();
    });
    expect(target.removeEventListener.mock.calls).toEqual([
      ["keyup", handler],
      ["keydown", handler],
    ]);
  });

  it("doesn't register the handler if enable is false", () => {
    mount(<Test type="keyup" enable={false} handler={handler} target={target} />);
    expect(target.addEventListener).toHaveBeenCalledTimes(0);
  });

  it("updates when target changes", () => {
    const target1 = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    const el = mount(<Test type="keyup" enable handler={handler} target={target} />);
    el.setProps({ target: target1 });
    expect(target1.addEventListener).toHaveBeenCalledWith("keyup", handler);
  });

  it("updates when type changes", () => {
    const handler1 = jest.fn();
    const el = mount(<Test type="keyup" enable handler={handler} target={target} />);
    expect(target.addEventListener).toHaveBeenCalledWith("keyup", handler);
    el.setProps({ type: "mousedown", handler: handler1 });
    expect(target.addEventListener).toHaveBeenCalledWith("mousedown", handler1);
  });

  it("updates when enable changes", () => {
    const el = mount(<Test type="keyup" enable={false} handler={handler} target={target} />);
    el.setProps({ enable: true });
    expect(target.addEventListener.mock.calls).toEqual([["keyup", handler]]);
  });
  it("updates when dependency changes", () => {
    const el = mount(
      <Test
        type="keyup"
        enable
        handler={handler}
        target={target}
        dependencies={["any-depdency"]}
      />,
    );
    el.setProps({ dependencies: ["changed-dependencies"] });
    expect(target.addEventListener).toHaveBeenCalledTimes(2);
  });
});
