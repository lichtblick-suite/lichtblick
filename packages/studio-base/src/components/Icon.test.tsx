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
import { render } from "@testing-library/react";

import { signal } from "@foxglove/den/async";

import Icon from "./Icon";

describe("<Icon />", () => {
  it("renders simple icon", () => {
    const result = render(
      <Icon>
        <CircleIcon />
      </Icon>,
    );
    expect(result.container.querySelector("svg")).not.toBeNullOrUndefined();
  });

  it("stops click event with custom handler", async () => {
    expect.assertions(0);
    const sig = signal();
    const Container = () => (
      <div onClick={() => sig.reject(new Error("should not bubble"))}>
        <Icon onClick={() => setTimeout(() => sig.resolve(), 0)}>
          <CircleIcon />
        </Icon>
      </div>
    );
    const result = render(<Container />);
    result.container
      .querySelector(".icon")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await sig;
  });

  it("does not prevent click by default", async () => {
    expect.assertions(0);
    const sig = signal();
    const Container = () => (
      <div onClick={() => sig.resolve()}>
        <Icon>
          <CircleIcon />
        </Icon>
      </div>
    );
    const result = render(<Container />);
    result.container
      .querySelector(".icon")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await sig;
  });
});
