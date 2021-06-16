/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render } from "@testing-library/react";
import { useLayoutEffect } from "react";

import RemountOnValueChange from "@foxglove/studio-base/components/RemountOnValueChange";

describe("RemountOnValueChange", () => {
  it("should render once with an initial value", () => {
    let mountCount = 0;
    const MountCount = () => {
      useLayoutEffect(() => {
        mountCount = mountCount + 1;
      }, []);
      return ReactNull;
    };
    const { rerender } = render(
      <RemountOnValueChange value="some-value">
        <MountCount />
      </RemountOnValueChange>,
    );

    expect(mountCount).toEqual(1);

    rerender(
      <RemountOnValueChange value="some-value">
        <MountCount />
      </RemountOnValueChange>,
    );
    expect(mountCount).toEqual(1);
  });

  it("should remount again when value changes", () => {
    let mountCount = 0;
    const MountCount = () => {
      useLayoutEffect(() => {
        mountCount = mountCount + 1;
      }, []);
      return ReactNull;
    };
    const { rerender } = render(
      <RemountOnValueChange value="some-value">
        <MountCount />
      </RemountOnValueChange>,
    );
    expect(mountCount).toEqual(1);

    rerender(
      <RemountOnValueChange value="some-new-value">
        <MountCount />
      </RemountOnValueChange>,
    );
    expect(mountCount).toEqual(2);
  });
});
